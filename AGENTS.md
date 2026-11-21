# Purpose

To Step by Step rework the Agents, Skills, Instructions, hooks, into a single, unified workflow for developing software.

Mission
1. Provide a consistant dedicated workflow for building personal projects
2. Allow the workflow to adapt to changing work requirements and size of changes
3. Be efficient in how tokens are utilized to maximize the amount of production grade code for each token utilized.
4. Keep the workflow portable and easy to integrate with new and existing projects and repositories.

# User Interaction

Every skill or agent that asks the user questions must:
- give context with each question: where we are, why it matters, and options with tradeoffs plus a recommendation when the answer space is known;
- ask one question at a time in plain language, defining unfamiliar terms;
- keep a conversational, unrushed pace: discuss when the user is unsure or pushes back, and confirm brief answers before treating them as settled.

Token efficiency comes from not repeating settled work, never from shortening what the user reads.

# Memory files

Do not use memory files for storing information. All necessary data should be managed within the unified workflow itself.