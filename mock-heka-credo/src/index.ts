import '@hyperledger/aries-askar-nodejs'

import express from 'express'
import {
  Agent,
  InitConfig,
  KeyType,
  W3cCredential,
  W3cCredentialSubject,
  JwaSignatureAlgorithm,
  DidKey,
} from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { AskarModule } from '@credo-ts/askar'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

/**
 * In-memory store for issued identities.
 * Replace with persistent DB in production.
 */
const identityStore: Record<string, { did: string; vc: unknown }> = {}

const app = express()
app.use(express.json())

const agentConfig: InitConfig = {
  label: 'Mock-Heka-Issuer',
  walletConfig: {
    id: 'heka-issuer-wallet',
    key: 'heka-super-secret-wallet-key',
  },
}

async function createAgent(): Promise<Agent> {
  const agent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({ ariesAskar }),
    },
  })

  await agent.initialize()
  return agent
}

async function createIssuerDid(agent: Agent): Promise<string> {
  const result = await agent.dids.create({
    method: 'key',
    options: { keyType: KeyType.Ed25519 },
  })

  if (!result.didState.did) {
    throw new Error('Failed to create issuer DID')
  }

  return result.didState.did
}

function setupRoutes(agent: Agent, issuerDid: string) {
  app.get('/status', (_, res) => {
    res.json({
      status: 'ok',
      issuerDid,
    })
  })

  app.post('/onboard', async (req, res) => {
    const { github_username } = req.body

    if (!github_username) {
      return res.status(400).json({
        error: 'github_username is required',
      })
    }

    try {
      const userDidResult = await agent.dids.create({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
      })

      const userDid = userDidResult.didState.did
      if (!userDid) { 
        throw new Error('User DID creation failed')
      }

      const issuerDidKey = DidKey.fromDid(issuerDid)
      const verificationMethod = `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`

      const credential = await agent.w3cCredentials.signCredential({
        credential: new W3cCredential({
          contexts: ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'GithubContributorCredential'],
          issuer: issuerDid,
          issuanceDate: new Date().toISOString(),
          credentialSubject: new W3cCredentialSubject({
            id: userDid,
            github_username,
            is_verified: true,
          }),
        }),
        verificationMethod,
        alg: JwaSignatureAlgorithm.EdDSA,
        format: 'jwt_vc',
      })

      identityStore[github_username] = {
        did: userDid,
        vc: credential,
      }

      return res.json({
        message: 'onboarding successful',
        did: userDid,
        credential,
      })
    } catch (error) {
      console.error('Onboarding error:', error)
      return res.status(500).json({
        error: 'Failed to issue credential',
      })
    }
  })

  // This route checks if the user's digital certificate is genuine or not
  app.post('/verify', async (req, res) => {
    const { github_username } = req.body

    if (!github_username) {
      return res.status(400).json({ error: 'github_username is required' })
    }

    console.log(`\n🔍 Verifying credential for: @${github_username}`);

    // 1. Fetch the user's credential from the Mock Cloud Wallet
    const userRecord = identityStore[github_username]
    if (!userRecord) {
      return res.status(404).json({ error: 'No credential found for this user. They need to onboard first.' })
    }

    try {
      // 2. Cryptographically verify the JWT signature using Credo
      const verificationResult = await agent.w3cCredentials.verifyCredential({
        credential: userRecord.vc as W3cCredential,
      })

      if (verificationResult.isValid) {
        console.log(`✅ Cryptographic signature is VALID!`);
        return res.json({
          status: 'verified',
          isValid: true,
          did: userRecord.did
        })
      } else {
        console.log(`❌ Cryptographic signature is INVALID!`);
        return res.status(401).json({
          status: 'failed',
          isValid: false,
          error: 'The credential signature could not be verified'
        })
      }

    } catch (error) {
      console.error('Verification error:', error)
      return res.status(500).json({ error: 'Internal verification engine failure' })
    }
  })



}

async function startServer() {
  const agent = await createAgent()
  const issuerDid = await createIssuerDid(agent)

  console.log(`Issuer DID: ${issuerDid}`)

  setupRoutes(agent, issuerDid)

  const PORT = 3000
  app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`)
  })
}

startServer().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/*
Flow of code -->

User → /onboard
   ↓
Create DID
   ↓
Create credential
   ↓
Sign credential
   ↓
Store it
   ↓
Return proof
*/