Stage and commit all changes with a user-friendly commit message.

## Instructions

1. Run `git status` to see all changed/untracked files
2. Run `git diff --stat` to understand what changed
3. Run `git log --oneline -5` to match the repository's commit message style
4. Stage all relevant files (exclude secrets, .env files, credentials)
5. Write a concise, descriptive commit message that:
   - Starts with an action verb (Add, Fix, Update, Refactor, Remove, etc.)
   - Summarizes the main change in the first line
   - Optionally includes bullet points for multiple changes
   - Does NOT include any Claude/AI attribution or footer
6. Commit the changes
7. Show the final status

Do NOT push to remote unless explicitly asked.
