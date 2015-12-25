/*
 * read md files, create -content.html and .html files
*/
var path = require('path');
var exec = require('child_process').exec;
var fs = require('fs-extra');
var filewalker = require('filewalker');
var async = require('async');
var shell = require('../helpers/hdshell');

module.exports = function (options) {
  var config = options.config;
  var inputFolder = config.input;

  /* make standalone html */
  async.waterfall([
    function (next) {
      var toRemove = [path.join(__cwd, config.output, 'html')];
      shell.run('rm -rf ' + toRemove.join(''), function () {
        next();
      });
    },
    function (next) {
      fs.ensureDir(path.join(__cwd, config.output, 'html'), function () {
        shell.run('cp -r public ' + path.join(__cwd, config.output, 'html'), function(copyErr, stdout, stderr) {
          if (copyErr) { return console.log(copyErr); }
          next();
        });
      });
    },
    function(makeHtmlStandalone) {
      var mydirs = [];
      var files = [];
      filewalker(inputFolder)
        .on('file', function(p, s) {files.push(p);})
        .on('dir', function (dir) { mydirs.push(dir); })
        .on('error', function(err) { return console.error(err); })
        .on('done', function() {
          var cleanFiles = files.filter(function (file) {
            var filename = file.split('/').pop();
            return !/^\./.test(file) && !/^\./.test(filename) && /\.md$/.test(filename);
          })
          .map(function (file) { return path.join(inputFolder, file); });
            makeHtmlStandalone(null, cleanFiles, mydirs);
        })
        .walk();
    },
    function(inputMdFiles, mydirs, callback) {
      var standaloneHtml = function (contentOnlyFile, mainTemplate, pageTitle) {
        fs.readFile(contentOnlyFile, 'utf-8', function (readErr, htmlFragment) {
          if (readErr) { console.log(readErr); }
          var standaloneContent = mainTemplate.replace(/@content/, htmlFragment).replace(/@title/, pageTitle);
          var nestCount = contentOnlyFile.replace(config.output + '/html/', '').split('/').length;
          var newPublicPath = function () {
            var publicPath = '';
            if (nestCount === 1) { publicPath += './'; }
            else { for (var i = 0; i < nestCount - 1; i++ ) { publicPath += '../'; } }
            publicPath = publicPath + 'public/';
            return publicPath;
          };
          standaloneContent = standaloneContent.replace(/public\//g, newPublicPath());
          var outputPath = contentOnlyFile.replace('-content.html', '.html');
          fs.writeFile(outputPath, standaloneContent, function (writeErr) {
            if (writeErr) {return console.log(writeErr);}
          });
        });
      };
      fs.readFile('./main.html', 'utf-8', function (tplReadErr, mainTemplate) {
        if (tplReadErr) { return console.log(tplReadErr); }
        inputMdFiles.forEach(function (mdFile) {
          var filePaths = mdFile.split('/');
          var filename = filePaths[filePaths.length - 1];
          var outputFolder = filePaths.slice(1, filePaths.length - 1).join('/');
          var dest = path.join(config.output, 'html', outputFolder);
          var writePath = path.join(dest, filename.replace('.md', '-content.html'));
          fs.readFile(mdFile, 'utf-8', function (errReadMd, mdContent) {
            var pageTitleRegx = new RegExp('[\s\S]*#\s*(.*)');
            var pageTitle = (mdContent.match(pageTitleRegx)) ? mdContent.match(pageTitleRegx)[1].trim() : '';
            if (errReadMd) { return console.log(errReadMd);}
            fs.ensureDir(dest, function (enErr) {
              var htmlFragmentCmd = 'pandoc --to=html ' + mdFile + ' -o ' + writePath;
              if (enErr) { return console.log(enErr);}
              exec(htmlFragmentCmd, function(contentErr, stdout, stderr) {
                if (contentErr) { return console.log(contentErr); }
                standaloneHtml(writePath, mainTemplate, pageTitle);
              });
            });
          });
        });
      });
    }
  ], function (err, result) {
     console.log('done creating the html main files');
  });
};