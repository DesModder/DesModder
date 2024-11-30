/* eslint-disable no-console */
import https from "https";
import fs from "fs";

const hashes = ["https://www.desmos.com/calculator/qb6nz9c3ur"];

// https://stackoverflow.com/a/22907134/7481517
function download(url, dest, callback) {
  const file = fs.createWriteStream(dest);
  https
    .get(url, function (response) {
      response.pipe(file);
      file.on("finish", function () {
        file.close(callback); // close() is async, call cb after close completes.
      });
    })
    .on("error", function (err) {
      // Handle errors
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      if (callback) callback(err.message);
    });
}

function downloadHash(hashIndex) {
  if (hashIndex >= hashes.length) {
    console.log("done");
    return;
  }
  let hash = hashes[hashIndex];
  hash = hash.replace("https://www.desmos.com/calculator/", "");
  const filename = `./calc_states/${hash}.json`;
  if (fs.existsSync(filename)) {
    console.log("Already downloaded", hash);
    downloadHash(hashIndex + 1);
  } else {
    console.log("Downloading", hash);
    download(
      `https://saved-work.desmos.com/calc-states/production/${hash}`,
      filename,
      // timeout to be nice to server
      () => setTimeout(() => downloadHash(hashIndex + 1), 400)
    );
  }
}

downloadHash(0);
