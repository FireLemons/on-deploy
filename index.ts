import * as core from '@actions/core'
import * as github from '@actions/github'
const token = core.getInput('token')
// Javascript destructuring assignment. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
const {owner, repo} = github.context.repo
const octokit = github.getOctokit(token)

const MAX_CARDS_PER_PAGE = 100 // from https://docs.github.com/en/rest/reference/projects#list-project-cards

// Lists up to MAX_CARDS_PER_PAGE cards from a column
//  @param    columnId The id of the column containing the cards
//  @param    pageNumber The page of up to MAX_CARDS_PER_PAGE cards to retrieve
//  @return   A promise representing fetching the page of cards
//    @fulfilled The card data
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError} if columnId is negative
//  @throws   {RangeError} if pageNumber is less than 1
//  @throws   {Error} if an error occurs while trying to fetch the card data
async function getCardPage (columnId: number, pageNumber: number): Promise<object> {
  if (!Number.isInteger(columnId)) {
    throw new TypeError('Param columnId is not an integer')
  } else if (columnId < 0) {
    throw new RangeError('Param columnId cannot be negative')
  }

  if (!Number.isInteger(pageNumber)) {
    throw new TypeError('Param pageNumber is not an integer')
  } else if (pageNumber < 1) {
    throw new RangeError('Param pageNumber cannot be less than 1')
  }

  const cardPageFetchResponse = await octokit.request('GET /projects/columns/{column_id}/cards', {
    column_id: columnId,
    archived_state: 'not_archived',
    page: pageNumber,
    per_page: MAX_CARDS_PER_PAGE
  })

  if (200 <= cardPageFetchResponse.status && cardPageFetchResponse.status < 300) {
    return cardPageFetchResponse.data
  } else {
    console.error(`Failed to fetch card page #${pageNumber} from column id=${columnId}`)
    throw new Error(JSON.stringify(cardPageFetchResponse, null, 2))
  }
}

async function main (): Promise<void> {
  const cardPageData = await getCardPage(16739169, 1)
  console.log(cardPageData)

  return
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
