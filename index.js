"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github = require("@actions/github");
const { owner, repo } = github.context.repo;
const columnNameDone = core.getInput('done_column_name');
const columnNameQA = core.getInput('QA_column_name');
const https = require('https');
const projectName = core.getInput('project_name');
const token = core.getInput('token');
const octokit = github.getOctokit(token);
const MAX_CARDS_PER_PAGE = 100; // from https://docs.github.com/en/rest/reference/projects#list-project-cards
function isSuccessStatus(status) {
    return 200 <= status && status < 300;
}
// Lists up to MAX_CARDS_PER_PAGE cards from a column
//  @param    columnId The id of the column containing the cards
//  @param    pageNumber The page of up to MAX_CARDS_PER_PAGE cards to retrieve
//  @return   A promise representing fetching the page of cards
//    @fulfilled The card data
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError} if columnId is negative
//  @throws   {RangeError} if pageNumber is less than 1
//  @throws   {Error} if an error occurs while trying to fetch the card data
async function getCardPage(columnId, pageNumber) {
    if (!Number.isInteger(columnId)) {
        throw new TypeError('Param columnId is not an integer');
    }
    else if (columnId < 0) {
        throw new RangeError('Param columnId cannot be negative');
    }
    if (!Number.isInteger(pageNumber)) {
        throw new TypeError('Param pageNumber is not an integer');
    }
    else if (pageNumber < 1) {
        throw new RangeError('Param pageNumber cannot be less than 1');
    }
    const cardPageFetchResponse = await octokit.request('GET /projects/columns/{column_id}/cards', {
        column_id: columnId,
        archived_state: 'not_archived',
        page: pageNumber,
        per_page: MAX_CARDS_PER_PAGE
    });
    if (isSuccessStatus(cardPageFetchResponse.status)) {
        return cardPageFetchResponse.data;
    }
    else {
        console.error(`Failed to fetch card page #${pageNumber} from column id=${columnId}`);
        throw new Error(JSON.stringify(cardPageFetchResponse, null, 2));
    }
}
// Get a column by name in a project
//  @param    columnName The name of the column
//  @param    projectId The id of the project containing the column
//  @return   A promise representing fetching of the column
//    @fulfilled An object representing the first column with name matching columnName
//                 undefined if the column could not be found
//  @throws   {RangeError} if columnName is empty string
//  @throws   {RangeError} if projectId is less than 1
//  @throws   {Error}      if an error occurs while trying to fetch the project data
async function getColumn(columnName, projectId) {
    if (!(columnName.length)) {
        throw new RangeError('Param projectName must be a non empty string');
    }
    if (projectId < 0) {
        throw new RangeError('Param projectId cannot be negative');
    }
    const columnList = await octokit.request('GET /projects/{project_id}/columns', {
        project_id: projectId
    });
    if (!isSuccessStatus(columnList.status)) {
        throw new Error(`Request to fetch project column list was not successful\n  request returned with status:${columnList.status}`);
    }
    return columnList.data.find((column) => {
        return column.name === columnName;
    });
}
// Get the latest deploy time
//  @return A promise representing fetching of the deploy time
//    @fulfilled The time of the latest deploy as a date object
//  @throws   {Error} if an error occurs while trying to fetch the project data
function getDeployTime() {
    return new Promise((resolve, reject) => {
        https.get('https://casavolunteertracking.org/health', (response) => {
            if (!isSuccessStatus(response.statusCode)) {
                reject(new Error(`Request to fetch deploy time was not successful\n  request returned with status:${response.statusCode}`));
                return;
            }
            response.on('data', (data) => {
                resolve(data['latest_deploy_time']);
            });
        }).on('error', (e) => {
            reject(e);
            return;
        });
    });
}
// Get the project with name passed into projectName from the current repo
//  @param projectName The name of the project
//  @return A promise representing fetching of the project
//    @fulfilled An object representing the first project with name matching projectName
//                 undefined if the project could not be found
//  @throws   {RangeError} if projectName is empty string
//  @throws   {Error}      if an error occurs while trying to fetch the project data
async function getProject(projectName) {
    if (!(projectName.length)) {
        throw new RangeError('Param projectName must be a non empty string');
    }
    const repoProjects = await octokit.request('GET /repos/{owner}/{repo}/projects', {
        owner: owner,
        repo: repo
    });
    if (!isSuccessStatus(repoProjects.status)) {
        throw new Error(`Request to fetch project data was not successful\n  request returned with status:${repoProjects.status}`);
    }
    return repoProjects.data.find((project) => {
        return project.name === projectName;
    });
}
async function main() {
    let columnIdDone;
    let columnIdQA;
    let project;
    try {
        project = await getProject(projectName);
        if (!project) {
            throw new Error('  No such project with matching name');
        }
    }
    catch (e) {
        console.error(`ERROR: Failed to find project with name "${projectName}"`);
        throw e;
    }
    try {
        const columnDone = await getColumn(columnNameDone, project.id);
        console.log(columnDone);
        if (!columnDone) {
            throw new Error(`Could not find column in project:"${projectName}" with name:"${columnNameDone}"`);
        }
        columnIdDone = columnDone.id;
    }
    catch (e) {
        console.error(`ERROR: Failed to find column with name ${columnNameDone}`);
        throw e;
    }
    try {
        const columnQA = await getColumn(columnNameQA, project.id);
        console.log(columnQA);
        if (!columnQA) {
            throw new Error(`Could not find column in project:"${projectName}" with name:"${columnNameQA}"`);
        }
        columnIdQA = columnQA.id;
    }
    catch (e) {
        console.error(`ERROR: Failed to find column with name ${columnNameQA}`);
        throw e;
    }
    try {
        console.log(getDeployTime());
    }
    catch (e) {
        console.error(`ERROR: Failed to fetch latest deploy time`);
        throw e;
    }
    return;
}
main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
