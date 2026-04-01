import { Agent, InitConfig, KeyType, W3cCredential, W3cCredentialSubject, JwaSignatureAlgorithm, DidKey } from '@credo-ts/core';
import { agentDependencies } from '@credo-ts/node';
import { AskarModule } from '@credo-ts/askar';
import { ariesAskar } from '@hyperledger/aries-askar-nodejs';

const agentConfig: InitConfig = {
  label: 'Mock-Testing',
  walletConfig: {
    id: 'test-wallet-' + Date.now(),
    key: 'test-key',
  },
}

async function test() {
  const agent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({ ariesAskar }),
    },
  })
  await agent.initialize();

  const issuerDidRes = await agent.dids.create({ method: 'key', options: { keyType: KeyType.Ed25519 } })
  const userDidRes = await agent.dids.create({ method: 'key', options: { keyType: KeyType.Ed25519 } })
  const issuerDid = issuerDidRes.didState.did!;
  const userDid = userDidRes.didState.did!;

  // Try modifying the instance directly
  const credentialSubject = new W3cCredentialSubject({
    id: userDid,
    claims: {
      github_username: "darshit2308_test",
      is_verified: true
    }
  });

  const issuerDidKey = DidKey.fromDid(issuerDid);
  const verificationMethod = `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`;

  const credential = await agent.w3cCredentials.signCredential({
    credential: new W3cCredential({
      contexts: ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'GithubContributorCredential'],
      issuer: issuerDid,
      issuanceDate: new Date().toISOString(),
      credentialSubject,
    }),
    verificationMethod,
    alg: JwaSignatureAlgorithm.EdDSA,
    format: 'jwt_vc',
  })

  console.log("SIGNED CREDENTIAL:");
  console.log(JSON.stringify(credential, null, 2));

  await agent.shutdown();
}

test().catch(console.error);
