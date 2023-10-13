const htmlparser = require("htmlparser2");
const axios = require("axios");
const papaparse = require("papaparse");
const cheerio = require("cheerio");
const { promises } = require("dns");

const wikicfp = "http://www.wikicfp.com/cfp/rss?cat=";
const googleScholar =
  "https://scholar.google.com/citations?hl=en&view_op=search_venues&vq=";
const categories = [
  "computer science",
  "security",
  "software engineering",
  "information technology",
  "communications",
  "networking",
  "information systems",
  "databases",
  "networks",
  "computer engineering",
  "semantic web",
  "software",
  "distributed systems",
  "blockchain",
];
const urls = categories.map((category) => wikicfp + category);

// <?xml version="1.0" encoding="UTF-8"?>
// <rss version="2.0">
//   <channel>
//     <title>CFPs on Education : WikiCFP</title>
//     <link>http://www.wikicfp.com/cfp/call?conference=education</link>
//     <description>A Wiki to Organize and Share Calls For Papers</description>
//     <item>
//       <title>EDTECH 2023 : 4th International Conference on Education and Integrating Technology</title>
//       <link>http://www.wikicfp.com/cfp/servlet/event.showcfp?eventid=176606&amp;copyownerid=171656</link>
//       <description>4th International Conference on Education and Integrating Technology [Vienna, Austria] [Oct 28, 2023 - Oct 29, 2023]</description>
//       <guid isPermaLink="false">cfp-976460-S@wikicfp.com</guid>
//     </item>
//   </channel>
// </rss>

const parse = (xml) => {
  const feed = htmlparser.parseFeed(xml);
  const conferences = feed.items.map((item) =>
    fetch(item.link).then((page) => {
      const pageData = scrape(page);
      const { title, link, description } = item;
      const name = clearTitle(title);
      return {
        title,
        link,
        description,
        ...pageData,
        name,
      };
    })
  );
  return Promise.all(conferences);
};

const fetch = (url) => {
  return axios.get(url).then((response) => response.data);
};

const fetchAll = (urls) => {
  return Promise.all(urls.map(fetch));
};

const parseAll = (xmls) => {
  return xmls.map((xml) => parse(xml));
};

const saveCsv = (conferences, filename) => {
  const csv = papaparse.unparse(conferences);
  const fs = require("fs");
  fs.writeFileSync(filename, csv);
};

// fetch item.link and scrape the page for more info
const scrape = (page) => {
  const $ = cheerio.load(page);
  const deadline = $(
    "body > div:nth-child(5) > center > table > tbody > tr:nth-child(5) > td > table > tbody > tr > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(3) > td > span > span:nth-child(3)"
  ).text();
  let note = $(
    "body > div:nth-child(5) > center > table > tbody > tr:nth-child(8) > td > div > div > p:nth-child(4)"
  ).text();

  if (note.length > 150 || note.length < 50) {
    note = "";
  }

  let categories = $(
    "body > div:nth-child(5) > center > table > tbody > tr:nth-child(5) > td > table > tbody > tr > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > h5"
  ).text();

  categories = categories
    .split("   ")
    .slice(1)
    .map((category) => category.trim());

  const link = $(
    "body > div:nth-child(5) > center > table > tbody > tr:nth-child(3) > td > a"
  ).text();

  return {
    deadline,
    note,
    categories,
    link,
  };
};

// Example titles
// ESCC--EI 2024 : 2024 the 6th European Symposium on Computer and Communications (ESCC 2024)
// ICCAI--EI 2024 : 2024 10th International Conference on Computing and Artificial Intelligence (ICCAI 2024)
// ICDIP 2024 : 2024 16th International Conference on Digital Image Processing (ICDIP 2024)
// ICICSE 2024 : IEEE--2024 the 4th International Conference on Information Communication and Software Engineering (ICICSE 2024)
// ICBDC 2024 : 2024 9th International Conference on Big Data and Computing (ICBDC 2024)
// RCIS 2024 : 18th Research Challenges in Information Science
// SEAI  2024 : 2024 4th IEEE International Conference on Software Engineering and Artificial Intelligence (SEAI 2024)
// IWPR 2024 : 2024 9th International Workshop on Pattern Recognition (IWPR 2024)
// WCSE--EI 2024 : 2024 The 14th International Workshop on Computer Science and Engineering (WCSE 2024)
// ICFCC--EI 2024 : 2024 The 16th International Conference on Future Computer and Communication (ICFCC 2024)
// remove everything till the name of the conference and remove everything name of the conference
// Example: ICBDC 2024 : 2024 9th International Conference on Big Data and Computing (ICBDC 2024) -> International Conference on Big Data and Computing
// Example: SEAI  2024 : 2024 4th IEEE International Conference on Software Engineering and Artificial Intelligence (SEAI 2024) -> IEEE International Conference on Software Engineering and Artificial Intelligence
// Example: WCSE--EI 2024 : 2024 The 14th International Workshop on Computer Science and Engineering (WCSE 2024) -> International Workshop on Computer Science and Engineering

const clearTitle = (title) => {
  const colon = title.split(":");
  let name = colon[colon.length - 1].trim();
  const regex = /(\d{4})\s(.*)\((.*)\)/;
  const match = name.match(regex);
  if (match) {
    name = match[2].trim();
  }
  // 2nd International Conference on Automation and Engineering
  // 8th International Conference on Networks and Communications
  // International Japan-Africa Conference on Electronics, Communications and Computations 2023
  // 17th IADIS International Conference Information Systems 2024
  // 22nd International Conference e-Society 2024
  // 20th International Conference Mobile Learning 2024
  // 17th IADIS International Conference Information Systems 2024
  // 22nd International Conference e-Society 2024
  // 27th Conference on Innovation in Clouds, Internet and Networks
  const regex2 = /(\d{1,2})(st|nd|rd|th)\s(.*)/;
  const match2 = name.match(regex2);
  if (match2) {
    name = match2[3].trim();
  }
  // remove the year
  const regex3 = /(.*)\s(\d{4})/;
  const match3 = name.match(regex3);
  if (match3) {
    name = match3[1].trim();
  }

  return name;
};

const main = () => {
  fetchAll(urls)
    .then(parseAll)
    .then(async (conferences) => {
      const all = (await Promise.all(conferences)).flat();
      // sort by deadline
      all.sort((a, b) => {
        const aDate = new Date(a.deadline);
        const bDate = new Date(b.deadline);
        return aDate - bDate;
      });
      saveCsv(all, "conferences.csv");
    });
};

main();
