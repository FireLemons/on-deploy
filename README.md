# on-deploy
If a deploy has been done witin the day,
 - All cards from the QA column are moved to the Done column

## Params
### done_column_card_limit:  
The maximum number of cards allowed in the done column  

### done_column_name:
The name of the column representing issues pushed to prod  

### QA_column_name:
The name of the column representing issues merged to QA  

### project_name:  
The name of the project to manage  

## Example Usage
```
on:
  schedule:
    - cron:  '0 1 * * *' # Run every day
  workflow_dispatch: # Enable Manual Runs

jobs:
  on_deploy:
    runs-on: ubuntu-latest
    name: On Deploy
    steps:
      - name: After Deploy
        uses: Firelemons/on-deploy@v1.0
        with:
          project_name: "CASA Volunteer Portal"
          done_column_name: "Done (in prod!)"
          QA_column_name: "Merged to QA"open
          token: ${{secrets.GITHUB_TOKEN}}
```

## Developing  
### Setup  
`git clone git@github.com:FireLemons/on-deploy.git` Clone the repo  
`cd on-deploy`  
`npm i` Install node dependencies  
Open and edit `index.ts`(a typescript file)  
Open a new terminal and run `npm run autocompile`. This will automatically compile `index.ts` into `index.js` every time `index.ts` is saved. Watch the window for typescript errors.
