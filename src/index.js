import path from 'path';
import fs from 'fs';
import async from 'async';
import moment from 'moment';
import { spawn } from 'child_process';
import inquirer from 'inquirer';
import colours from 'colors';

// const maxAgeInSecs = moment(1, 'week').unix();
const maxAgeInSecs = 1400;

const baseFilePath = path.resolve(__dirname, '../../');

const localNodeModules = path.resolve(__dirname, '../node_modules');
const otherNodeModules = path.resolve(__dirname, '../../cruk-api/node_modules');
const paths = [];
paths.push(localNodeModules);
paths.push(otherNodeModules);

function getStats(filepath, cb) {
  fs.stat(filepath, (err, stats) => {
    if (err || !stats) throw err;
    cb(err, {
      path: filepath,
      stats: stats
    });
  });
}

function isOld(item) {
  const timestamp = new Date(item.stats.atime).getTime();
  const now = new Date().getTime();
  const diff = now - timestamp;
  if (diff > maxAgeInSecs) {
    return true;
  }
  return false;
}

function uninstallAllPackages(folderFilepath) {
  const packagePath = path.resolve(folderFilepath, 'package.json');
  const depsObj = require(packagePath).dependencies;
  const devDepsObj = require(packagePath).devDependencies || {};
  const params = Object.keys(depsObj).concat(Object.keys(devDepsObj));
  const uninstall = spawn('npm', ['uninstall', params], {
    cwd: folderFilepath
  });
  uninstall.stdout.on('data', (data) => {
    console.log(`${data}`.green);
  });
  uninstall.stderr.on('data', (data) => {
    console.log(`${data}`.yellow);
  });
}

// function containsNodeModules(filename, cb) {
//   const filepath = path.resolve(baseFilePath, filename);
//   const isDir = fs.lstatSync(filepath).isDirectory();

//   if (isDir) {
//     fs.readdir(filepath, (err, files) => {
//       if (err) throw err;
//       const index = files.indexOf('node_modules');
//       cb(index !== -1 ? true : false);
//     });
//   } else {
//     cb(false);
//   }
// }

function promptUninstall(oldFolders) {
  inquirer.prompt([{
    type: 'list',
    name: 'name',
    message: 'Tidy up some old node_modules folders?',
    choices: () => {
      return oldFolders.map(i => {
        return {
          name: i.path + ' - ' + i.stats.atime,
          value: i
        };
      }).sort((a, b) => {
        // oldest first
        return new Date(b.value.stats.atime).getTime() - new Date(a.value.stats.atime).getTime();
      });
    }
  }], choice => {
    uninstallAllPackages(choice.name.path);
  });
}

function findOldFolders(filepaths) {
  async.map(filepaths, getStats, function checkAges(err, results) {
    const oldFolders = results.filter(isOld);
    promptUninstall(oldFolders);
  });
}

function findCodeFolders(filepath) {
  fs.readdir(filepath, (err, files) => {
    if (err) throw err;
    const absFiles = files.map(f => path.normalize(baseFilePath + '/' + f));
    findOldFolders(absFiles.filter(f => fs.lstatSync(f).isDirectory()));
    // async.filter(absFiles, containsNodeModules, findOldFolders);
  });
}


findCodeFolders(baseFilePath);

