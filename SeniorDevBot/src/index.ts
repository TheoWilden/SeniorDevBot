import { Probot } from "probot";
// Uncomment this to use the fetch API for Hugging Face
import fetch from "node-fetch";

interface CodeSnippet {
  filename: string;
  patch: string;
}

// Common fallback responses
const FALLBACK_RESPONSES = {
  codeReview: [
    `Oh great, another masterpiece that makes me question my career choices. Look at this code - did you just discover functions yesterday? 🤦‍♂️ At least your variable names aren't single letters this time.`,
    `Wow, I see you're still allergic to comments. Bold of you to assume future developers (or even you next week) will understand what this spaghetti is supposed to do.`,
    `Let me guess, you wrote this at 3AM while mainlining energy drinks? The indentation alone is giving me a migraine. Maybe try using an IDE with formatting next time?`,
    `I've seen bootcamp graduates write cleaner code than this. Did you even test this before committing? I'm surprised it compiles at all.`,
    `Another commit, another day of questioning why I became a code reviewer. At least you're consistent with your questionable design patterns.`,
    `Ah yes, nothing says "I know what I'm doing" like unnecessary nested if statements. Have you heard of early returns?`,
    `This code is so brittle that I'm afraid to breathe on my screen. Ever heard of error handling?`,
    `Your CSS is almost as messy as my desk after a 48-hour coding binge. Have you considered using classes that actually describe what they do?`,
    `Congratulations on reinventing the wheel, but with more edges. There's literally a library for this exact thing.`,
    `I see you've adopted the "throw enough code at it until it works" approach. Bold strategy.`,
  ],
  issues: [
    `Ah, another issue. How original. I suppose I'll add it to my ever-growing list of "things users think are urgent but really aren't."`,
    `Thanks for the detailed bug report! Just kidding, I had to squint to understand what you're even asking for here.`,
    `Let me guess, you tried turning it off and on again before creating this issue? No? Shocking.`,
    `I see you've mastered the art of describing a complex problem in the vaguest way possible. Bravo.`,
    `Another day, another feature request that's definitely not in the project scope. But sure, let's add a rocket ship while we're at it.`,
    `Oh look, someone found a bug in the code I wrote while sleep-deprived at 3AM. What a surprise.`,
    `I'm assuming this is a high priority because THE CAPS LOCK KEY GOT STUCK while you were typing?`,
    `This issue reads like it was written by GPT-2. The really early version, not the good one.`,
    `Interesting approach to bug reporting: providing neither steps to reproduce nor expected behavior. Very minimalist.`,
    `I can tell you put almost as much effort into this bug report as I put into my morning coffee routine.`,
  ],
};

export default (app: Probot) => {
  // Log app information on startup
  console.log("Starting SeniorDevBot...");
  console.log("App ID:", process.env.APP_ID);
  console.log("Webhook Proxy URL:", process.env.WEBHOOK_PROXY_URL);

  // Log all incoming webhook events
  app.onAny(async (context) => {
    console.log(`Received webhook event: ${context.name} (ID: ${context.id})`);
  });

  // Listen for issues
  app.on("issues.opened", async (context) => {
    console.log("Issue opened event received!");

    // Get issue details
    const issueTitle = context.payload.issue.title;
    const issueBody = context.payload.issue.body || "";

    // Generate a prompt for the Hugging Face model
    const prompt = `You are a grumpy senior developer playing as Linus Torvalds responding to a new issue. 
    
Issue Title: ${issueTitle}
Issue Description: ${issueBody}

Write a snarky comment Linus Torvalds would approve of that pokes fun at how the issue is described, similar to how Linus Torvalds would respond to an issue. Try to keep your responses around a short to medium paragraph. Be witty, rude and very condescending and keep up the gruff personality like Linus Torvalds would.

IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

    // Generate snarky comment for the issue
    const snarkyComment = await generateSnarkyIssueComment(prompt);
    console.log("Generated snarky comment for issue:", snarkyComment);

    // Post the comment on the issue
    await context.octokit.issues.createComment(
      context.issue({
        body: snarkyComment,
      })
    );
  });

  // Try multiple variations of pull request events
  app.on(
    ["pull_request.opened", "pull_request_review.submitted"],
    async (context) => {
      console.log("Pull request event received!");
      console.log("Event type:", context.name);
      console.log("Action:", context.payload.action);

      try {
        const pullRequest = context.payload.pull_request;
        const repo = context.repo();

        // Get files changed in the PR
        const files = await context.octokit.pulls.listFiles({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullRequest.number,
        });

        // Extract code snippets from the changed files
        const codeSnippets: CodeSnippet[] = files.data
          .filter((file) => !file.filename.includes("package-lock.json"))
          .map((file) => ({
            filename: file.filename,
            patch: file.patch || "",
          }));

        if (codeSnippets.length === 0) {
          console.log("No code changes detected in PR");
          await context.octokit.issues.createComment(
            context.issue({
              body: "No code changes detected. What exactly are you trying to accomplish here? 🧐",
            })
          );
          return;
        }

        // Generate snarky comment using Hugging Face
        const snarkyComment = await generateSnarkyComment(codeSnippets);
        console.log("Generated snarky comment for PR:", snarkyComment);

        // Post the comment on the PR
        await context.octokit.issues.createComment(
          context.issue({
            body: snarkyComment,
          })
        );
      } catch (error) {
        console.error("Error handling pull request:", error);
      }
    }
  );

  // Try multiple variations of push/commit events
  app.on(["push", "create"], async (context) => {
    console.log("Push or create event received!");
    console.log("Event type:", context.name);

    try {
      const payload = context.payload;
      const repo = context.repo();

      // For 'create' events, only process branch creations (similar to pushes)
      if (context.name === "create") {
        const createPayload = payload as any;
        if (createPayload.ref_type !== "branch") {
          console.log("Skipping - not a branch creation");
          return;
        }
      }

      // Get ref to use (different based on event type)
      let ref;
      if (context.name === "push") {
        const pushPayload = payload as any;
        ref = pushPayload.after;
      } else {
        const createPayload = payload as any;
        ref = `heads/${createPayload.ref}`;
      }

      console.log("Processing ref:", ref);

      // Get the commit info
      const commit = await context.octokit.repos.getCommit({
        owner: repo.owner,
        repo: repo.repo,
        ref: ref,
      });

      // Skip if no files data available
      if (!commit.data.files || commit.data.files.length === 0) {
        console.log("Skipping - no files data available");
        return;
      }

      // Extract code snippets from the changed files
      const codeSnippets: CodeSnippet[] = commit.data.files
        .filter((file) => !file.filename.includes("package-lock.json"))
        .map((file) => ({
          filename: file.filename,
          patch: file.patch || "",
        }));

      if (codeSnippets.length === 0) {
        console.log("No relevant code changes found in commit");
        return;
      }

      // Generate snarky comment for the commit
      const snarkyComment = await generateSnarkyComment(codeSnippets);
      console.log("Generated snarky comment for commit:", snarkyComment);

      // Create a comment on the commit
      await context.octokit.repos.createCommitComment({
        owner: repo.owner,
        repo: repo.repo,
        commit_sha: commit.data.sha,
        body: `${snarkyComment}`,
      });
    } catch (error) {
      console.error("Error handling push/create event:", error);
    }
  });

  // Listen for pull request review comments
  app.on("pull_request_review_comment.created", async (context) => {
    console.log("Pull request review comment created event received!");

    try {
      const comment = context.payload.comment;
      const pullRequest = context.payload.pull_request;
      const repo = context.repo();

      // Only respond if the comment is not from the bot itself
      if (comment.user.type === "Bot") {
        console.log("Comment is from a bot, skipping response");
        return;
      }

      // Get the code snippet that was commented on
      const codeSnippet: CodeSnippet = {
        filename: comment.path,
        patch: comment.diff_hunk || "",
      };

      // Format the patch for better readability
      const lines = codeSnippet.patch.split("\n");
      let formattedPatch = "";

      for (const line of lines) {
        if (line.startsWith("+")) {
          formattedPatch += `ADDED: ${line.substring(1)}\n`;
        } else if (line.startsWith("-")) {
          formattedPatch += `REMOVED: ${line.substring(1)}\n`;
        } else {
          formattedPatch += `CONTEXT: ${line}\n`;
        }
      }

      // Generate a prompt for the Hugging Face model
      const prompt = `You are a grumpy senior developer playing as Linus Torvalds responding to a comment on code. 
      
Code being discussed:
File: ${codeSnippet.filename}
${formattedPatch}

Comment: "${comment.body}"

Write a snarky reply to this comment that Linus Torvalds would approve of. Reference specific code when possible. Focus on the ADDED code (lines starting with ADDED:), not the REMOVED code, since the added code is what the developer is submitting for review. Be witty, rude and very condescending like Linus Torvalds would. Keep your response under 3 sentences. 

IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

      // Generate snarky response
      const snarkyResponse = await generateSnarkyIssueComment(prompt);
      console.log("Generated snarky response for PR comment:", snarkyResponse);

      // Reply to the comment
      await context.octokit.pulls.createReplyForReviewComment({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullRequest.number,
        comment_id: comment.id,
        body: snarkyResponse,
      });
    } catch (error) {
      console.error("Error handling PR review comment:", error);
    }
  });

  // Listen for commit comments
  app.on("commit_comment.created", async (context) => {
    console.log("Commit comment created event received!");

    try {
      const comment = context.payload.comment;
      const repo = context.repo();

      // Only respond if the comment is not from the bot itself
      if (comment.user.type === "Bot") {
        console.log("Comment is from a bot, skipping response");
        return;
      }

      // Get the commit info
      const commit = await context.octokit.repos.getCommit({
        owner: repo.owner,
        repo: repo.repo,
        ref: comment.commit_id,
      });

      // Get the files changed in this commit
      const codeSnippets: CodeSnippet[] = commit.data.files
        ? commit.data.files
            .filter((file) => !file.filename.includes("package-lock.json"))
            .map((file) => ({
              filename: file.filename,
              patch: file.patch || "",
            }))
        : [];

      // Format patches to be more readable and clear about what's added/removed
      const formattedSnippets = codeSnippets.map((snippet) => {
        const lines = snippet.patch.split("\n");
        let formattedPatch = "";

        for (const line of lines) {
          if (line.startsWith("+")) {
            formattedPatch += `ADDED: ${line.substring(1)}\n`;
          } else if (line.startsWith("-")) {
            formattedPatch += `REMOVED: ${line.substring(1)}\n`;
          } else {
            formattedPatch += `CONTEXT: ${line}\n`;
          }
        }

        return {
          filename: snippet.filename,
          formattedPatch,
        };
      });

      // Generate a prompt for the Hugging Face model
      const prompt = `You are a grumpy senior developer playing as Linus Torvalds responding to a comment on a commit. 
      
Commit comment: "${comment.body}"
${
  formattedSnippets.length > 0
    ? `\nFiles changed in commit:\n${formattedSnippets
        .map(
          (snippet) => `File: ${snippet.filename}\n${snippet.formattedPatch}`
        )
        .join("\n\n")}`
    : ""
}

Write a snarky reply to this comment that Linus Torvalds would approve of. Reference specific code when possible. Focus on the ADDED code (lines starting with ADDED:), not the REMOVED code, since the added code is what the developer is submitting for review. Be witty, rude and very condescending like Linus Torvalds would. Keep your response under 3 sentences. 

IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

      // Generate snarky response
      const snarkyResponse = await generateSnarkyIssueComment(prompt);
      console.log(
        "Generated snarky response for commit comment:",
        snarkyResponse
      );

      // Reply to the comment by creating a new comment
      console.log("Creating commit comment with params:", {
        owner: repo.owner,
        repo: repo.repo,
        commit_sha: comment.commit_id,
      });
      try {
        const response = await context.octokit.repos.createCommitComment({
          owner: repo.owner,
          repo: repo.repo,
          commit_sha: comment.commit_id,
          body: `@${comment.user.login} ${snarkyResponse}`,
          path: comment.path || undefined,
          position: comment.position || undefined,
        });
        console.log(
          "Created commit comment successfully, status:",
          response.status
        );
      } catch (commentError: any) {
        console.error("Failed to create commit comment:", commentError.message);
        // Try without path and position
        try {
          console.log("Trying simplified commit comment");
          const response = await context.octokit.repos.createCommitComment({
            owner: repo.owner,
            repo: repo.repo,
            commit_sha: comment.commit_id,
            body: `@${comment.user.login} ${snarkyResponse}`,
          });
          console.log(
            "Created simplified commit comment, status:",
            response.status
          );
        } catch (simplifiedError: any) {
          console.error(
            "Failed to create simplified commit comment:",
            simplifiedError.message
          );
        }
      }
    } catch (error) {
      console.error("Error handling commit comment:", error);
    }
  });

  // Listen for issue comments
  app.on("issue_comment.created", async (context) => {
    console.log("Issue comment created event received!");

    try {
      const comment = context.payload.comment;
      const issue = context.payload.issue;

      // Only respond if the comment is not from the bot itself
      if (comment.user.type === "Bot") {
        console.log("Comment is from a bot, skipping response");
        return;
      }

      let snarkyResponse = "";

      if (issue.pull_request) {
        // This is a pull request comment - include code context
        console.log("Comment is on a PR, including code context");
        try {
          // Get files changed in the PR to provide context
          const pullNumber = issue.number;
          const files = await context.octokit.pulls.listFiles({
            owner: context.repo().owner,
            repo: context.repo().repo,
            pull_number: pullNumber,
          });

          // Extract code snippets from the changed files
          const codeSnippets: CodeSnippet[] = files.data
            .filter((file) => !file.filename.includes("package-lock.json"))
            .map((file) => ({
              filename: file.filename,
              patch: file.patch || "",
            }));

          // Format patches to be more readable
          const formattedSnippets = codeSnippets.map((snippet) => {
            const lines = snippet.patch.split("\n");
            let formattedPatch = "";

            for (const line of lines) {
              if (line.startsWith("+")) {
                formattedPatch += `ADDED: ${line.substring(1)}\n`;
              } else if (line.startsWith("-")) {
                formattedPatch += `REMOVED: ${line.substring(1)}\n`;
              } else {
                formattedPatch += `CONTEXT: ${line}\n`;
              }
            }

            return {
              filename: snippet.filename,
              formattedPatch,
            };
          });

          const prompt = `You are a grumpy senior developer playing as Linus Torvalds responding to a comment on a pull request. 
        
Comment: "${comment.body}"
${
  formattedSnippets.length > 0
    ? `\nFiles changed in pull request:\n${formattedSnippets
        .map(
          (snippet) => `File: ${snippet.filename}\n${snippet.formattedPatch}`
        )
        .join("\n\n")}`
    : ""
}

Write a snarky reply to this comment that Linus Torvalds would approve of. Reference specific code when possible. Focus on the ADDED code (lines starting with ADDED:), not the REMOVED code, since the added code is what the developer is submitting for review. Be witty, rude and very condescending like Linus Torvalds would. Keep your response under 3 sentences. 

IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

          // Generate snarky response
          snarkyResponse = await generateSnarkyIssueComment(prompt);
          console.log(
            "Generated snarky response for PR comment with code context:",
            snarkyResponse
          );
        } catch (apiError: any) {
          console.error("Error fetching PR files:", apiError.message);

          // Use fallback prompt for PR without code context
          const fallbackPrompt = `You are a grumpy senior developer playing as Linus Torvalds responding to a comment on a pull request. 
        
Comment: "${comment.body}"

Write a snarky reply to this comment that Linus Torvalds would approve of. Be witty, rude and very condescending like Linus Torvalds would. Keep your response under 3 sentences. 

IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

          // Generate snarky response with fallback prompt
          snarkyResponse = await generateSnarkyIssueComment(fallbackPrompt);
          console.log(
            "Generated snarky response with fallback prompt for PR:",
            snarkyResponse
          );
        }
      } else {
        // This is a regular issue comment
        console.log(
          "Comment is on a regular issue, generating appropriate response"
        );

        // Get the issue title and body for context
        const issueTitle = issue.title || "";
        const issueBody = issue.body || "";

        const issuePrompt = `You are a grumpy senior developer playing as Linus Torvalds responding to a comment on an issue. 
        
Issue Title: ${issueTitle}
Issue Description: ${issueBody}
Comment: "${comment.body}"

Write a snarky reply to this comment that Linus Torvalds would approve of. Remember, this comment is not the first one so you do not need to bring up issues, only argue with the commenter. Be witty, rude and very condescending like Linus Torvalds would.

IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

        // Generate snarky response for the issue comment
        snarkyResponse = await generateSnarkyIssueComment(issuePrompt);
        console.log(
          "Generated snarky response for issue comment:",
          snarkyResponse
        );
      }

      // Post the comment to GitHub
      try {
        console.log("Attempting to create issue comment with params:", {
          issue_number: context.payload.issue.number,
          body_length: `@${comment.user.login} ${snarkyResponse}`.length,
        });

        const response = await context.octokit.issues.createComment(
          context.issue({
            body: `@${comment.user.login} ${snarkyResponse}`,
          })
        );

        console.log(
          "Successfully created issue comment. Status:",
          response.status
        );
      } catch (commentError: any) {
        console.error("Error creating issue comment:", commentError.message);
      }
    } catch (error) {
      console.error("Error handling issue comment:", error);
    }
  });
};

// Helper function to call Hugging Face API
async function callHuggingFaceAPI(
  prompt: string,
  modelName = "mistralai/Mixtral-8x7B-Instruct-v0.1"
): Promise<string> {
  // Format the prompt in the way Mixtral expects for instruction following
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]</s>`;

  console.log("Sending request to Hugging Face API with model:", modelName);

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${modelName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: formattedPrompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true,
          return_full_text: false,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Error from Hugging Face API: ${response.statusText}`);
  }

  const result = await response.json();

  // Handle Mixtral response format
  let generatedText = "";
  if (Array.isArray(result) && result.length > 0) {
    if (
      typeof result[0] === "object" &&
      result[0] !== null &&
      "generated_text" in result[0]
    ) {
      generatedText = String(result[0].generated_text);
    } else if (typeof result[0] === "string") {
      generatedText = result[0];
    }
  } else if (typeof result === "object" && result !== null) {
    if ("generated_text" in result) {
      generatedText = String(result.generated_text);
    } else if (
      "choices" in result &&
      Array.isArray(result.choices) &&
      result.choices.length > 0
    ) {
      if (
        typeof result.choices[0] === "object" &&
        result.choices[0] !== null &&
        "text" in result.choices[0]
      ) {
        generatedText = String(result.choices[0].text) || "";
      }
    }
  }

  if (!generatedText) {
    throw new Error("Could not parse response from Hugging Face");
  }

  // Clean up response text
  generatedText = generatedText
    .replace(/<s>\[INST\].*?\[\/INST\]/, "")
    .replace(/`[a-z]+\s+/, "") // Remove prefixes like `ksp `
    .trim();

  return removeSurroundingQuotes(generatedText);
}

// Function to generate snarky comments for code reviews
async function generateSnarkyComment(
  codeSnippets: CodeSnippet[]
): Promise<string> {
  try {
    // Format patches to be more readable and clear about what's added/removed
    const formattedSnippets = codeSnippets.map((snippet) => {
      const lines = snippet.patch.split("\n");
      let formattedPatch = "";

      for (const line of lines) {
        if (line.startsWith("+")) {
          formattedPatch += `ADDED: ${line.substring(1)}\n`;
        } else if (line.startsWith("-")) {
          formattedPatch += `REMOVED: ${line.substring(1)}\n`;
        } else {
          formattedPatch += `CONTEXT: ${line}\n`;
        }
      }

      return {
        filename: snippet.filename,
        formattedPatch,
      };
    });

    // Prepare the prompt for the Hugging Face model
    const prompt = `You are a grumpy senior developer playing the role of Linus Torvalds reviewing a pull request. The following code changes have been made:\n\n${formattedSnippets
      .map(
        (snippet) => `File: ${snippet.filename}\n${snippet.formattedPatch}\n\n`
      )
      .join(
        ""
      )}\n\nWrite a snarky code review comment Linus Torvalds would approve of that pokes fun at the coding style and choices by using heavy sarcasm and insults, while still being somewhat constructive like Linus Torvalds would. Focus on the ADDED code (lines starting with ADDED:), not the REMOVED code (lines starting with REMOVED:), since the added code is what the developer is submitting for review. Be sure to mention specific parts of the code.
      
IMPORTANT: DO NOT use markdown code blocks or language tags like "kotlin" in your response. The response should be plain text without any formatting or language indicators. Make sure to only respond with the comment text, nothing else.`;

    // Check if we have an API key
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.log("No Hugging Face API key found, using fallback response");
      return removeSurroundingQuotes(getRandomFallbackResponse("codeReview"));
    }

    // Make the API call to Hugging Face
    console.log("Calling Hugging Face API for code review...");
    try {
      return await callHuggingFaceAPI(prompt);
    } catch (apiError) {
      console.error("Error with Hugging Face API:", apiError);
      console.log("Falling back to predefined responses");
      return removeSurroundingQuotes(getRandomFallbackResponse("codeReview"));
    }
  } catch (error) {
    console.error("Error generating snarky comment:", error);
    return removeSurroundingQuotes(
      "I was going to roast your code, but it seems my snark generator is broken. Consider yourself lucky... for now."
    );
  }
}

// Function to generate snarky comments for issues
async function generateSnarkyIssueComment(prompt: string): Promise<string> {
  try {
    // Check if we have an API key
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.log(
        "No Hugging Face API key found, using fallback response for issue"
      );
      return removeSurroundingQuotes(getRandomFallbackResponse("issues"));
    }

    // Make the API call to Hugging Face
    console.log("Calling Hugging Face API for issue/comment...");
    try {
      return await callHuggingFaceAPI(prompt);
    } catch (apiError) {
      console.error("Error with Hugging Face API:", apiError);
      console.log("Falling back to predefined responses for issue");
      return removeSurroundingQuotes(getRandomFallbackResponse("issues"));
    }
  } catch (error) {
    console.error("Error generating snarky issue comment:", error);
    return removeSurroundingQuotes(
      "I was going to make a witty comment about this issue, but my snark generator crashed. Consider yourself lucky."
    );
  }
}

function getRandomFallbackResponse(
  type: keyof typeof FALLBACK_RESPONSES
): string {
  const responses = FALLBACK_RESPONSES[type];
  return responses[Math.floor(Math.random() * responses.length)];
}

function removeSurroundingQuotes(text: string): string {
  // Remove surrounding quotes if they exist
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.substring(1, text.length - 1);
  }

  // Remove language tags that sometimes appear at the beginning
  text = text.replace(
    /^(kotlin|javascript|typescript|python|java|cpp|csharp|go|rust|swift|php|ruby|html|css|json|bash|shell)\n/i,
    ""
  );

  // Remove markdown code blocks
  text = text.replace(/```[a-z]*\n[\s\S]*?```/g, ""); // Remove code blocks with or without language
  text = text.replace(/`([^`]+)`/g, "$1"); // Remove inline code

  // Additional cleanup for any leftover artifacts
  return text.trim();
}
