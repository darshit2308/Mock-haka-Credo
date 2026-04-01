import { W3cCredentialSubject } from '@credo-ts/core';

try {
  const subject1 = new W3cCredentialSubject({
    id: "did:example:123",
    additionalProperties: {
      github_username: "darshit2308",
      is_verified: true
    }
  } as any);
  console.log("subject1:", JSON.stringify(subject1));
} catch(e) { console.log(e); }

try {
  const subject2 = new W3cCredentialSubject({
    id: "did:example:123"
  });
  
  (subject2 as any).github_username = "darshit2308";
  (subject2 as any).is_verified = true;
  console.log("subject2 directly assigned:", JSON.stringify(subject2));
} catch(e) { console.log(e); }

try {
  const subject3 = new W3cCredentialSubject({
    id: "did:example:123",
    github_username: "darshit2308",
    is_verified: true
  } as any);
  console.log("subject3 constructor direct:", JSON.stringify(subject3));
} catch(e) { console.log(e); }
