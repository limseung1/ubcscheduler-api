const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
let port = process.env.PORT || 3001;
const cors = require("cors")
app.use(
  cors({
    // origin:"https://ubcscheduler.herokuapp.com",
    origin:"*",
    optionsSuccessStatus: 200,
    methods:["GET"],
  })
)
app.listen(port, () => {
  console.log(`This app is listening on port http://localhost:${port}`)
})



app.get("/", async (req, res) => {
  res.status(200).send("Welcome to UBC Scheduler's API")
})



/**
 * collects subject and number to create appropriate
 * url to send to the scraper. return the response in json format
 */
app.get("/api/sections", async (req, res) => {
  // Directory: /api/sections?subject=CPSC&number=110'
  const subject = req.query.subject
  const number = req.query.number
  
  //Blocked:
  // const url = `https://courses.students.ubc.ca/cs/courseschedule?pname=subjarea&tname=subj-course&dept=${subject}&course=${number}`
  const url = `https://courses.students.ubc.ca/cs/courseschedule?tname=subj-course&course=${number}&sessyr=2022&sesscd=W&dept=${subject}&pname=subjarea`

  const data = await scrapeData(url); //hold until response comes back
  res.status(200).json({ sections: data })
})


/**
 * scrapes section data from UBC course website.
 * first finds the table containing the data, 
 * .table.table-striped.section-summary
 * then parse tr nested in the element.
 * run loops to collect neccessary info.
 * @param {string} url 
 * @returns 
 */
const scrapeData = async (url) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
  await page.goto(url)

  const data = await page.evaluate(() => {
    let acc = [] // accumulates section
    const trTags = document.querySelectorAll('.table.table-striped.section-summary tbody tr')
    console.log(trTags)
    const create_UUID = () => {
      let dt = new Date().getTime();
      let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          let r = (dt + Math.random()*16)%16 | 0;
          dt = Math.floor(dt/16);
          return (c=='x' ? r :(r&0x3|0x8)).toString(16);
      });
      return uuid;
    }
    trTags.forEach(tr => {
      const tds = tr.children // all tds inside <tr> element

      const id = create_UUID();
      const status = tds[0].innerHTML === " " ? "Available" : tds[0].innerHTML
      const name = tds[1].innerText
      const [subject, course, section] = name.split(" ");
      const activity = tds[2].innerHTML
      const term = tds[3].innerHTML
      const days = tds[6].innerHTML.trimStart()
      const start_time = tds[7].innerHTML
      const end_time = tds[8].innerHTML

      const make_timeslot = (startTime, endTime, day, term) => {
        let startArr = startTime.split(":").map((s) => parseInt(s));
        let endArr = endTime.split(":").map((s) => parseInt(s));
        let nstart = (startArr[0]*60)+startArr[1];
        let nend = (endArr[0]*60)+endArr[1];
        return {start_time: nstart, end_time: nend, day:day, term:term};
      }

      
      const schedule =  days.split(" ").map(d => (make_timeslot( start_time, end_time, d, term )))
      const section_data = {
        id: id,
        status: status,
        name: name,
        subject: subject,
        course: course,
        section: section,
        activity: activity,
        term: term,
        schedule: schedule
      }
      acc.push(section_data)
    })
    return acc
  })
  await browser.close()
  return data
}


