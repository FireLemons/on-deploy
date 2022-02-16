"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github = require("@actions/github");
const { owner, repo } = github.context.repo;
const token = core.getInput('token');
const octokit = github.getOctokit(token);
const MAX_CARDS_PER_PAGE = 100; // from https://docs.github.com/en/rest/reference/projects#list-project-cards
function isSuccessStatus(response) {
    return 200 <= response.status && response.status < 300;
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
    if (isSuccessStatus(cardPageFetchResponse)) {
        return cardPageFetchResponse.data;
    }
    else {
        console.error(`Failed to fetch card page #${pageNumber} from column id=${columnId}`);
        throw new Error(JSON.stringify(cardPageFetchResponse, null, 2));
    }
}
/*
// Get a column by name in a project
//  @param    columnName The name of the column
//  @param    projectId The id of the project containing the column
//  @return   A promise representing fetching of the column
//    @fulfilled An object representing the first column with name matching columnName
//                 undefined if the column could not be found
//  @throws   {RangeError} if projectId is less than 1
//  @throws   {Error}      if an error occurs while trying to fetch the project data
async function getColumn (columnName: string, projectId: number): Promise<object> {
  if (projectId < 0) {
    throw new RangeError('Param projectId cannot be negative')
  }

  const columnList = await octokit.request('GET /projects/{project_id}/columns', {
    project_id: projectId
  })

  return columnList.data.find((column) => {
    return column.name === columnName
  })
}

async function main (): Promise<void> {
  const cardPageData = await getCardPage(16739169, 1)
  console.log(cardPageData)

  return
}*/
main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
