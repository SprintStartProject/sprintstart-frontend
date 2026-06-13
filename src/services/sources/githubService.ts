export type ConnectGithubRepositoryRequest = {
    owner: string;
    name: string;
};

/**
 * Connects a GitHub repository to SprintStart.
 *
 * This triggers the backend GitHub connector, which starts fetching repository
 * files, issues, pull requests and other GitHub data in the background.
 *
 * @param request - The GitHub repository owner and repository name.
 * @throws Error if the repository connection fails.
 */
export async function connectGithubRepository(
    request: ConnectGithubRepositoryRequest,
): Promise<void> {
    const res = await fetch("/api/v1/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });

    if (!res.ok) {
        throw new Error("Failed to connect GitHub repository");
    }
}