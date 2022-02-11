import * as core from '@actions/core'
import * as github from '@actions/github'
const token = core.getInput('token')
// Javascript destructuring assignment. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
const {owner, repo} = github.context.repo
const octokit = github.getOctokit(token)

const MAX_CARDS_PER_PAGE = 100 // from https://docs.github.com/en/rest/reference/projects#list-project-cards
