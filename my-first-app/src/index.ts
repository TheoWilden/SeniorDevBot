import { Probot } from "probot";
// Commented out for now, will be used when implementing the actual API call
// import fetch from "node-fetch";

interface CodeSnippet {
  filename: string;
  patch: string;
}

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
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
      await context.octokit.issues.createComment(
        context.issue({
          body: "No code changes detected. What exactly are you trying to accomplish here? 🧐",
        })
      );
      return;
    }

    // Generate snarky comment using Hugging Face
    const snarkyComment = await generateSnarkyComment(codeSnippets);

    // Post the comment on the PR
    await context.octokit.issues.createComment(
      context.issue({
        body: snarkyComment,
      })
    );
  });

  // Handle push events (commits)
  app.on("push", async (context) => {
    const payload = context.payload;
    const repo = context.repo();

    // Skip if this is not to the default branch
    if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) {
      return;
    }

    // Skip if there are no commits
    if (!payload.commits || payload.commits.length === 0) {
      return;
    }

    // Get the commit info
    const commitSha = payload.after;
    const commit = await context.octokit.repos.getCommit({
      owner: repo.owner,
      repo: repo.repo,
      ref: commitSha,
    });

    // Skip if no files data available
    if (!commit.data.files || commit.data.files.length === 0) {
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
      return;
    }

    // Generate snarky comment for the commit
    const snarkyComment = await generateSnarkyComment(codeSnippets);

    // Create a comment on the commit
    await context.octokit.repos.createCommitComment({
      owner: repo.owner,
      repo: repo.repo,
      commit_sha: commitSha,
      body: `${payload.pusher.name}, I see you've committed some... "code":\n\n${snarkyComment}`,
    });
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

async function generateSnarkyComment(
  codeSnippets: CodeSnippet[]
): Promise<string> {
  try {
    // Prepare the prompt for the Hugging Face model - saved for future implementation
    /* const prompt = `You are a grumpy senior developer reviewing a pull request. The following code changes have been made:\n\n${
      codeSnippets.map(snippet => 
        `File: ${snippet.filename}\n${snippet.patch}\n\n`
      ).join('')
    }\n\nWrite a snarky code review comment that pokes fun at the coding style and choices, while still being somewhat constructive. Be sure to mention specific parts of the code.`; */

    // In a real implementation, you would call the Hugging Face API here
    // For now, we'll use some predefined responses as a fallback
    const fallbackResponses = [
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
    ];

    // For demonstration, randomly select a fallback response
    // In production, replace with actual API call to Hugging Face
    return fallbackResponses[
      Math.floor(Math.random() * fallbackResponses.length)
    ];

    /* 
    // This is how you would implement the actual Hugging Face API call:
    const response = await fetch("https://api-inference.huggingface.co/models/gpt2", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });
    
    if (!response.ok) {
      throw new Error(`Error from Hugging Face API: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result[0].generated_text;
    */
  } catch (error) {
    console.error("Error generating snarky comment:", error);
    return "I was going to roast your code, but it seems my snark generator is broken. Consider yourself lucky... for now.";
  }
}
