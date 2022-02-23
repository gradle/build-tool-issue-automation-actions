const core = require('@actions/core');
const github = require('@actions/github');
const {Octokit} = require('@octokit/action');
const process = require('process');

const octokit = new Octokit();

const labelToBoard = {
  '@execution': 24,
  '@dev-productivity': 17,
};

function extractData(issue) {
  return {
    id: issue.node_id,
    number: issue.number,
    labels: issue.labels.map(label => label.name),
  };
}

async function queryProjectId(projectNumber) {
  const result = await octokit.graphql(`
    query($org: String!, $number: Int!) {
        organization(login: $org){
          projectNext(number: $number) {
            id
          }
        }
      }
    `, {
    org: 'gradle',
    number: projectNumber,
  });
  return result.organization.projectNext.id;
}

async function addToBoardGraphQl(projectId, nodeId) {
  await octokit.graphql(`
    mutation($project:ID!, $node:ID!) {
        addProjectNextItem(input: {projectId: $project, contentId: $node}) {
          projectNextItem {
            id
          }
        }
      }
    `, {
    project: projectId,
    node: nodeId,
  });
}

async function addToBoard(issueData, boardNumber) {
  core.info(`Adding #${issueData.number} to board ${boardNumber}`);
  const projectId = await queryProjectId(boardNumber);
  addToBoardGraphQl(projectId, issueData.id);
}

try {
  if (!process.env.GITHUB_TOKEN) {
    core.notice('Github token not set - skipping action');
    return;
  }
  const payload = github.context.payload;
  const issueData = [payload.pull_request, payload.issue]
      .filter(it => it != null)
      .map(extractData)[0];
  if (issueData) {
    const boardsForIssue = issueData.labels
        .map(label => labelToBoard[label])
        .filter(label => label != null);
    boardsForIssue.forEach(boardNumber => addToBoard(issueData, boardNumber));
  }
} catch (error) {
  core.setFailed(error.message);
}
