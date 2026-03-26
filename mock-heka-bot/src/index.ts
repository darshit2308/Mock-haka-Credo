import {Probot} from 'probot';
import axios from 'axios';

export default (app : Probot) => {
  app.log.info("Mock haka bot is live and listening !");

  // This beliw line tells, the probot to trigger, when PR is opened, or updated
  app.on(["pull_request.opened", "pull_request.synchronize"], async(context) => {
    
    // fetching the information from the github webhook payload
    const username = context.payload.pull_request.user.login;
    const sha = context.payload.pull_request.head.sha; // commit hash
    const repoInfo = context.repo(); // used to get the repo owner and name

    app.log.info(`\n Spotted a PR from ${username} , Starting verification ... `);

    // as soon as abive step happens, we post 'In progress' sttaus on PR
    await context.octokit.checks.create({
      ...repoInfo, 
      name: "Heka Identity Verification", 
      head_sha: sha, 
      status: "in_progress",
    });

    try {
      // Now we will try to connect with the mock heka identity server, running on 3000
      const response = await axios.post("http://localhost:3000/verify", {
        github_username: username, 
      });

      // Now, the heka might respond with valid, or invalid
      if(response.data.isValid) {
        app.log.info(`Successfully verified the ${username}`);
        // after the user is verified, update the PR panel in the github
        await context.octokit.checks.create({
          ...repoInfo, 
          name: "Heka Identity Verification", 
          head_sha: sha, 
          status: "completed",
          conclusion: "success", 
          output: {
            title: "Contributor Verified" ,
            summary: `Idenitity of user ${username} has been verified cryptographically \n \n Decentralised Identifier (DID) : ** \`${response.data.did}\`  `,
          },
        });
      }
    } catch(error: any) {
      app.log.error(`Verification failed for ${username} `);
      // If the verification faced some issue, update the PR panel
      await context.octokit.checks.create({
        ...repoInfo, 
        name: "Heka Identity Verification",
        head_sha: sha,
        status: "completed",
        conclusion: "failure",
        output: {
          title: "Unverified Contributor",
          summary: `We could not verify a decentralized identity credential for **@${username}**.\n\n Please onboard via the Heka Portal to receive your Verifiable Credential before contributing.`,
        },
      });
    }
  });
};