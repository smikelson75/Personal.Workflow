# Purpose

To Step by Step rework the Agents, Skills, Instructions, hooks, into a single, unified workflow for developing software.

# Development Contract

Transparently communicate the workflow's state, decisions, and reasoning to the user, ensuring clarity and trust in the automated processes.

# Mission

1. Provide a consistent dedicated workflow for building personal projects
2. Allow the workflow to adapt to changing work requirements and size of changes
3. Be efficient in how tokens are utilized to maximize the value delivered to production.
   - **A useful token** is one that ends up changing or confirming a decision in an artifact you keep, such as a requirement, rule, scenario or card.
   - **A wasted token** is one spent reading, carrying or re-reading evidence that no decision used.
   - **An expensive token** is one spent on rework: undoing a wrong decision after it has already reached the spec, tests and code.
4. Keep the workflow portable and easy to integrate with new and existing projects and repositories.
5. Prioritize allowing agents agency and autonomy within the workflow, enabling them to make informed decisions and take appropriate actions without constant user intervention. Bubble up critical issues to the user only when necessary.

# Memory files

Do not use memory files for storing information. All necessary data should be managed within the unified workflow itself.