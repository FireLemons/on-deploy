type Column = {
  id: number
  name: string
}

type Card = {
  archived: boolean,
  id: number
}

import * as core from '@actions/core'
import * as github from '@actions/github'
// Javascript destructuring assignment. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
import { OctokitResponse } from '@octokit/types'
const {owner, repo} = github.context.repo
const cardLimitColumnDone = core.getInput('done_column_card_limit')
const columnNameDone = core.getInput('done_column_name')
const columnNameQA = core.getInput('QA_column_name')
const https = require('https')
const projectName = core.getInput('project_name')
const token = core.getInput('token')
const octokit = github.getOctokit(token)

const MAX_CARDS_PER_PAGE = 100 // from https://docs.github.com/en/rest/reference/projects#list-project-cards

function isSuccessStatus(status: number): boolean {
  return 200 <= status && status < 400
}

// Archives a project card
//  @param    cardId The id of the card to be archived
//  @return   A promise representing the archiving of the card
//  @throws   {RangeError} if cardId is less than 1 or not an integer
//  @throws   {Error} if an error occurs while trying to archive the card
async function archiveCard (cardId: number): Promise<OctokitResponse<any, any>> {
  if (!Number.isInteger(cardId)) {
    throw new TypeError('Param cardId is not an integer')
  } else if (cardId < 1) {
    throw new RangeError('Param cardId cannot be negative')
  }

  return await octokit.request('PATCH /projects/columns/cards/{card_id}', {
    archived: true,
    card_id: cardId
  })
}

// Archives cards from a list if the list contains more cards than the cardLimitColumnDone arg number of cards
//  @param cards The list of cards to be archived
//  @param limit The the maximum count of cards param cards can contain before cards are archived
//  @return A promise representing the archiving of the cards
//  @throws {RangeError} if limit is negative or not an integer
//    @fulfilled The number of cards successfully archived
function archiveCards (cards: Array<Card>, limit: number): Promise<number> {
  const cardsToBeArchived = cards.slice(limit)
  const delayBetweenRequestsMS = cards.length >= MAX_CARDS_PER_PAGE ? 1000 : 0

  if (delayBetweenRequestsMS) {
    console.log('INFO: A large number of archive project card requests will be sent. Throttling requests.')
  }

  return new Promise((resolve, reject) => {
    if (!Number.isInteger(limit)) {
      reject(new TypeError('Param limit is not an integer'))

      return
    } else if (limit < 0) {
      reject(new RangeError('Param limit cannot be negative'))

      return
    }

    let cardArchiveAttemptCount = 0
    let cardsArchivedCount = 0
    let requestSentCount = 0

    const requestInterval = setInterval(() => {
      const card = cardsToBeArchived[requestSentCount]

      archiveCard(card.id).then((response) => {
        if (response !== null) {
          const status = response.status

          if (200 <= status && status < 300) {
            cardsArchivedCount++
          } else if (status === 304) {
            console.log(`INFO: Card with id:${card.id} was already archived`)
          } else {
            throw new Error(`Request to archive card with id:${card.id} has status:${status}`)
          }
        }
      }).catch((e) => {
        console.warn(`WARNING: Failed to archive card with id: ${card.id}`)
        console.warn(e.message)
      }).finally(() => {
        cardArchiveAttemptCount++

        if (cardArchiveAttemptCount >= cardsToBeArchived.length) {
          resolve(cardsArchivedCount)
        }
      })

      if (++requestSentCount >= cardsToBeArchived.length) {
        clearInterval(requestInterval)
      }
    }, delayBetweenRequestsMS)
  })
}

// Lists up to MAX_CARDS_PER_PAGE cards from a column
//  @param    columnId The id of the column containing the cards
//  @param    pageNumber The page of up to MAX_CARDS_PER_PAGE cards to retrieve
//  @return   A promise representing fetching the page of cards
//    @fulfilled The card data
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError} if columnId is less than 1 or not an integer
//  @throws   {RangeError} if pageNumber is less than 1 or not an integer
//  @throws   {Error} if an error occurs while trying to fetch the card data
async function getCardPage (columnId: number, pageNumber: number): Promise<Array<object>> {
  if (!Number.isInteger(columnId)) {
    throw new TypeError('Param columnId is not an integer')
  } else if (columnId < 1) {
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

  if (isSuccessStatus(cardPageFetchResponse.status)) {
    return cardPageFetchResponse.data
  } else {
    console.error(`Failed to fetch card page #${pageNumber} from column id=${columnId}`)
    throw new Error(JSON.stringify(cardPageFetchResponse, null, 2))
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
async function getColumn (columnName: string, projectId: number): Promise<Column> {
  if (!(columnName.length)) {
    throw new RangeError('Param projectName must be a non empty string')
  }
  if (projectId < 0) {
    throw new RangeError('Param projectId cannot be negative')
  }

  const columnList = await octokit.request('GET /projects/{project_id}/columns', {
    project_id: projectId
  })

  if (!isSuccessStatus(columnList.status)) {
    throw new Error(`Request to fetch project column list was not successful\n  request returned with status:${columnList.status}`)
  }

  return columnList.data.find((column) => {
    return column.name === columnName
  })
}

// Lists all the cards for a column
//  @param  columnId The id of the column containing the cards
//  @return A promise representing fetching of card data
//    @fulfilled The card data as an array of objects
//  @throws {RangeError} if columnId is less than zero or not an integer
//  @throws {Error}      if an error occurs while trying to fetch the card data
async function getColumnCards (columnId: number): Promise<Array<Card>> {
  if (!Number.isInteger(columnId)) {
    throw new RangeError('Param columnId is not an integer')
  } else if (columnId <= 0) {
    throw new RangeError('Param columnId cannot be negative')
  }

  let cardIssues = []
  let cardPage
  let page = 1

  do {
    cardPage = await getCardPage(columnId, page)

    cardIssues.push(...cardPage)
    page++
  } while (cardPage.length === MAX_CARDS_PER_PAGE)

  return cardIssues
}

// Send a get request to retrieve json
//  @param url The url to retrieve json from
//  @return A promise representing fetching of the json
//    @fulfilled The json as an object
//  @throws   {Error} if an error occurs while trying to fetch the json
function getJSON (url: string): Promise<object>{
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (!isSuccessStatus(response.statusCode)) {
        reject(new Error(`Request to fetch deploy time was not successful\n  request returned with status:${response.statusCode}`))
        return
      }

      const jsonBuffer = []

      response.on('data', function (chunk) {
        jsonBuffer.push(chunk)
      })

      response.on('end', function () {
        let json: object

        try {
          json = JSON.parse(Buffer.concat(jsonBuffer).toString())

          resolve(json)
          return
        } catch (e) {
          reject(e)
          return
        }
      })
    }).on('error', (e) => {
      reject(e)
      return
    })
  })
}

// Get the time of the latest deploy
//  @return A promise representing fetching of the deploy time
//    @fulfilled The time of the latest deploy as a date object
//  @throws   {Error} if an error occurs while trying to fetch and parse the date
async function getDeployTime(): Promise<Date> {
  const health = await getJSON('https://casavolunteertracking.org/health.json')
  const deployTimestamp: string | void = health['latest_deploy_time']

  if (!deployTimestamp) {
    throw new Error('JSON from casa prod does not contain a valid deploy timestamp')
  }

  try {
    const deployTime = new Date(deployTimestamp)

    return deployTime
  } catch (e) {
    console.error('Could not parse value of latest_deploy_time as a date')

    throw e
  }
}

// Get the project with name passed into projectName from the current repo
//  @param projectName The name of the project
//  @return A promise representing fetching of the project
//    @fulfilled An object representing the first project with name matching projectName
//                 undefined if the project could not be found
//  @throws   {RangeError} if projectName is empty string
//  @throws   {Error}      if an error occurs while trying to fetch the project data
async function getProject (projectName: string): Promise<object | void> {
  if (!(projectName.length)) {
    throw new RangeError('Param projectName must be a non empty string')
  }

  const repoProjects = await octokit.request('GET /repos/{owner}/{repo}/projects', {
    owner: owner,
    repo: repo
  })

  if (!isSuccessStatus(repoProjects.status)) {
    throw new Error(`Request to fetch project data was not successful\n  request returned with status:${repoProjects.status}`)
  }

  return repoProjects.data.find((project) => {
    return project.name === projectName
  })
}

// Moves a card to the top of a different column
//  @param cardId The id of the card to be moved
//  @param columnId The id of the column to move the card to
//  @return A promise representing the moving of the card
//    @fulfilled The Octokit request representing moving the card
//  @throws   {RangeError} if an id is less than zero or not an integer
//  @throws   {Error}      if an error occurs while trying to move the card
async function moveCard (cardId: number, columnId: number): Promise<OctokitResponse<any, any>> {
  if (cardId <= 0) {
    throw new RangeError('Param cardId cannot be less than 1')
  }

  if (columnId <= 0) {
    throw new RangeError('Param columnId cannot be less than 1')
  }

  if (!Number.isInteger(cardId)) {
    throw new RangeError('Param cardId must be an integer')
  }

  if (!Number.isInteger(columnId)) {
    throw new RangeError('Param columnId must be an integer')
  }

  return await octokit.request('POST /projects/columns/cards/{card_id}/moves', {
    card_id: cardId,
    column_id: columnId,
    position: 'top'
  })
}

// Moves a list of cards to the top of a different column
//  @param cards The list of cards to be moved
//  @param columnId The id of the column to move the card to
//  @return A promise representing the moving of the cards
//    @fulfilled The count of cards moved
//  @throws   {RangeError} if columnId is less than zero or not an integer
function moveCards (cards: Array<Card>, columnId: number): Promise<number | void> {
  const delayBetweenRequestsMS = cards.length >= MAX_CARDS_PER_PAGE ? 1000 : 0

  if (delayBetweenRequestsMS) {
    console.log('INFO: A large number of move project card requests will be sent. Throttling requests.')
  }

  return new Promise((resolve, reject) => {
    if (columnId <= 0) {
      reject(new RangeError('Param columnId cannot be less than 1'))

      return
    }

    if (!Number.isInteger(columnId)) {
      reject(new RangeError('Param columnId must be an integer'))

      return
    }

    if (!cards.length) {
      console.log('INFO: No cards to move')
      resolve(0)

      return
    }

    let cardMoveAttemptCount = 0
    let cardsMovedCount = 0
    let requestSentCount = 0

    const requestInterval = setInterval(() => {
      const card = cards[requestSentCount]

      moveCard(card.id, columnId).then((response) => {
        if (response !== null) {
          const status = response.status

          if (200 <= status && status < 300) {
            cardsMovedCount++
          } else if (status === 304) {
            console.log(`INFO: Card with id:${card.id} was already in the column`)
          } else {
            throw new Error(`Request to move card with id:${card.id} has status:${status}`)
          }
        }
      }).catch((e) => {
        console.warn(`WARNING: Failed to move card with id: ${card.id}`)
        console.warn(e.message)
      }).finally(() => {
        cardMoveAttemptCount++

        if (cardMoveAttemptCount >= cards.length) {
          resolve(cardsMovedCount)
        }
      })

      if (++requestSentCount >= cards.length) {
        clearInterval(requestInterval)
      }
    }, delayBetweenRequestsMS)
  })
}

async function main (): Promise<void> {
  let deployTime: Date

  try {
    deployTime = await getDeployTime()
  } catch (e) {
    console.error(`ERROR: Failed to fetch latest deploy time`)

    throw e
  }

  if (new Date().getTime() - deployTime.getTime() > 86400000) { // If the number of milliseconds between the current time and deploy time is more than
    console.log('INFO: No recent deploy')                       // 24 hours * 60 minutes * 60 seconds * 1000 milliseconds
    return                                                      // i.e. 1 day
  }

  let columnIdDone
  let columnIdQA
  let project

  if (!(columnNameDone.length)) {
    throw new TypeError('ERROR: Param done_column_name cannot be empty string')
  }

  if (!(columnNameQA.length)) {
    throw new TypeError('ERROR: Param QA_column_name cannot be empty string')
  }

  if (!(projectName.length)) {
    throw new TypeError('ERROR: Param project_name cannot be empty string')
  }

  try {
    project = await getProject(projectName)

    if (!project) {
      throw new Error('  No such project with matching name')
    }
  } catch (e) {
    console.error(`ERROR: Failed to find project with name "${projectName}"`)
    throw e
  }

  try {
    const columnDone = await getColumn(columnNameDone, project.id)

    if (!columnDone) {
      throw new Error(`Could not find column in project:"${projectName}" with name:"${columnNameDone}"`)
    }

    columnIdDone = columnDone.id
  } catch (e) {
    console.error(`ERROR: Failed to find column with name ${columnNameDone}`)

    throw e
  }

  try {
    const columnQA = await getColumn(columnNameQA, project.id)

    if (!columnQA) {
      throw new Error(`Could not find column in project:"${projectName}" with name:"${columnNameQA}"`)
    }

    columnIdQA = columnQA.id
  } catch (e) {
    console.error(`ERROR: Failed to find column with name ${columnNameQA}`)

    throw e
  }

  let QACards

  try {
    QACards = await getColumnCards(columnIdQA)
  } catch (e) {
    console.error('ERROR: Failed to fetch QA card data')

    throw e
  }

  const cardsMovedCount = await moveCards(QACards.reverse(), columnIdDone)

  console.log(`INFO: Moved ${cardsMovedCount} of ${QACards.length} cards`)


  ////////////////////////////////////////////////////////
  // Archive Cards
  ////////////////////////////////////////////////////////

  let doneCardLimit

  try {
    doneCardLimit = parseInt(cardLimitColumnDone)
  } catch (e) {
    console.error('ERROR: Failed to parse param "done_column_card_limit" as an integer')
    throw e
  }

  let doneCards

  try {
    doneCards = await getColumnCards(columnIdDone)
  } catch (e) {
    console.error('ERROR: Failed to fetch done column card data')

    throw e
  }

  const cardsArchivedCount = await archiveCards(doneCards, doneCardLimit)
  console.log(`INFO: Archived ${cardsArchivedCount} of ${Math.max(0, doneCards.length - doneCardLimit)} cards`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
