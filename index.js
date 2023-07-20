const fs = require('fs');
const path = require('path');
const fetch = require('cross-fetch');


function mdlinks(file, options) {
  const filePath = path.resolve(file); 
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
          if (err.code === 'ENOENT') {
          reject(`O arquivo/diretório ${filePath} não foi encontrado no caminho especificado.`);
        } else {
          reject(err);
        } 
      } else {
        if (stats.isDirectory()) {
          const markdownFiles = [];
          searchRecursion(filePath, (file) => {
            if (file.endsWith('.md')) {
              markdownFiles.push(file);
            }
          });
          const promises = markdownFiles.map((mdFile) =>
            readMarkdownFile(mdFile, options)
          );
          Promise.all(promises)
            .then((results) => {
              const links = results.flatMap((result) => result.links);
              const statistics = statisticsLinks(links);
              resolve({ links, statistics });
            })
            .catch((error) => reject(error));
        } else if (stats.isFile() && path.extname(file) === '.md') {
          readMarkdownFile(filePath, options)
            .then((result) => {
              resolve(result);
            })
            .catch((error) => reject(error));
        } else {
          reject(`O ${file} não é um arquivo Markdown.`);
        }
      }
    });
  });
}

function searchRecursion(absDirPath, fileCallback) {
  try {
    const files = fs.readdirSync(absDirPath);
    for (const file of files) {
      const filePath = path.join(absDirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        searchRecursion(filePath, fileCallback);
      } else {
        fileCallback(filePath);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

function readMarkdownFile(filePath, options) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        console.log(error);
        reject(error);
      } else {
        const links = findLinksInMarkdown(data, filePath);
        if (options && options.validate) {
          validateLinks(links)
            .then((validatedLinks) => {
              const statistics = statisticsLinks(validatedLinks);
              resolve({ links: validatedLinks, statistics });
            })
            .catch((error) => reject(error));
        } else {
          const statistics = statisticsLinks(links);
          resolve({ links, statistics });
        }
      }
    });
  });
}

function findLinksInMarkdown(data, filePath) {
  const regex = /\[([^[\]]*?)\]\((https?:\/\/[^\s?#.].[^\s]*)\)/gm;
  const links = [];
  let match;
  while ((match = regex.exec(data)) !== null) {
    const text = match[1];
    const href = match[2];
    const fileName = path.basename(filePath);
    links.push({ text, href, file: fileName });
  }
  return links;
}

function validateFetch(url) {
  return fetch(url.href)
    .then((response) => ({
      ...url,
      status: response.status,
      ok: response.ok ? 'ok' : 'fail',
    }))
    .catch((error) => ({
      ...url,
      status: error,
      ok: 'fail',
    }));
}


function validateLinks(links) {
  const linkPromises = links.map((link) => validateFetch(link));
  return Promise.all(linkPromises);
}

function statisticsLinks(links) {
  const totalLinks = links.length;
  const uniqueLinks = [...new Set(links.map((link) => link.href))].length;
  const brokenLinks = links.filter((link) => link.ok === 'fail').length;
  return {
    total: totalLinks,
    unique: uniqueLinks,
    broken: brokenLinks,
  };
}

module.exports = { mdlinks, validateLinks, searchRecursion,  readMarkdownFile, validateFetch, statisticsLinks };
