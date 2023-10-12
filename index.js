const htmlparser = require("htmlparser2");
const axios = require("axios");
const papaparse = require("papaparse");
const cheerio = require("cheerio");
const { promises } = require("dns");

const wikicfp = "http://www.wikicfp.com/cfp/rss?cat=";
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
      return {
        title,
        link,
        description,
        ...pageData,
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
