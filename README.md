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
          QA_column_name: "Merged to QA"
          token: ${{secrets.GITHUB_TOKEN}}
```
