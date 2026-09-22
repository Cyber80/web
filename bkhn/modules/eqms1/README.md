# Google Apps Script Deployment Instructions

To deploy this backend as a Google Apps Script web app, please follow these steps:

1. **Open Google Apps Script:**
   Go to [script.google.com](https://script.google.com/) and create a new project.

2. **Add Code.gs:**
   Copy the contents of `Code.gs` from this folder and paste it into the `Code.gs` file in the Apps Script editor.

3. **Add index.html:**
   In the Apps Script editor, click the `+` icon next to "Files", select "HTML", and name it `index.html`.
   Copy the contents of `index.html` from this folder and paste it into the new `index.html` file in the editor.

4. **Deploy as Web App:**
   - Click on the "Deploy" button at the top right, then select "New deployment".
   - Set the deployment type to "Web app".
   - Execute as: "Me"
   - Who has access: "Anyone" (or customize according to your needs).
   - Click "Deploy".
   
5. **Database Initialization:**
   The `Code.gs` script automatically reads and writes to a file named `local_db.json` in your Google Drive root directory. When you run the web app for the first time, it will generate a mock database in that file if it doesn't already exist.

You can now use the generated Web App URL to access the Exam Analysis System running completely on Google Apps Script and Google Drive!
