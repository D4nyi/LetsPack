const { minify } = require("terser");
const postcss = require("postcss");
const autoprefixer = require("autoprefixer");
const importer = require("postcss-import");
const csso = require("postcss-csso");
const fs = require("fs");
const path = require("path");
const md5 = require("md5-file");

const terserConfig = {
  mangle: true,
  compress: {},
};

/**
 * @class LetsPack
 */
class LetsPack {
  /**
   * @callback onFileContent
   * @param {string} fileName the name of the file, wothout the path and extension
   * @param {string} fileContent the content of the file
   * @returns {void}
   */

  /**
   * @type {{css: string|null, js: string|null}}
   */
  outputFiles = {
    css: null,
    js: null,
  };

  /**
   * Bundels the provided array of scripts or scripts from a directory into one minified file
   * @param {string | string[]} scripts the input files or directory
   * @param {string} output the output file path with file name
   * @return {this}
   */
  scripts(scripts, output) {
    this.outputFiles.js = output;
    output = path.resolve(output);

    const codes = {};
    /** @type {onFileContent} */
    const cb = (name, content) => {
      codes[name] = content;
    };

    if (Array.isArray(scripts)) {
      this.#readFiles(
        scripts.map((script) => path.resolve(script)),
        cb
      );
    } else if (typeof scripts === "string") {
      scripts = path.resolve(scripts);
      this.#readDirectoryFiles(scripts, cb);
    } else {
      throw Error("Uknown type for 'scripts'!");
    }

    minify(codes, terserConfig).then((options) =>
      fs.writeFile(output, options.code, (err) => {
        if (err) console.log(err);
        this.#printSize(output, this.outputFiles.js);
      })
    );

    return this;
  }

  /**
   * Processes the provided style with PostCss, PostCss-Import, Autoprefixer and Csso.
   * Because of PostCss-Import you don't need to provide multiple files to create bundles, just add an '@import <path>' tag at begining of your main css.
   * @param {string} style your main css path and name
   * @param {string} output the output file path with file name
   * @return {this}
   */
  styles(style, output) {
    this.outputFiles.css = output;
    output = path.resolve(output);

    if (typeof style !== "string") {
      throw Error("Uknown type for 'styles'!");
    }

    style = path.resolve(style);
    fs.readFile(style, (err, css) => {
      if (err) {
        console.error(err);
        return;
      }
      postcss([importer, autoprefixer, csso])
        .process(css, {
          from: style,
          to: output,
        })
        .then((result) => {
          fs.writeFile(output, result.css, (err) => {
            if (err) console.log(err);
            this.#printSize(output, this.outputFiles.css);
          });
        })
        .catch((err) => console.error(err));
    });

    return this;
  }

  /**
   * Creates a mix.manifest.json for laravel to vesion its static files
   * @return {void}
   */
  version() {
    const jsPromise = md5(this.outputFiles.js).then((hash) => ({ js: hash }));
    const cssPromise = md5(this.outputFiles.css).then((hash) => ({
      css: hash,
    }));

    Promise.all([jsPromise, cssPromise]).then((results) => {
      const mix = {};
      /** @param {string} fileName */
      const cb = (fileName) => {
        if (fileName.startsWith(".")) {
          fileName = fileName.substring(1);
        }
        if (fileName.includes("\\")) {
          fileName = fileName.replace("\\", "/");
        }
        return fileName;
      };

      results.forEach((result) => {
        const object = result.js ? this.outputFiles.js : this.outputFiles.css;
        const fileName = cb(object);
        mix[fileName] = fileName + "?id=" + (result.js || result.css);
      });
    });
  }

  /**
   * Reads every file from the provided directory
   * @param {string} dirName
   * @param {onFileContent} onFileContent
   */
  #readDirectoryFiles(dirName, onFileContent) {
    const files = fs
      .readdirSync(dirName, "utf-8")
      .map((file) => path.join(dirName, file));
    this.#readFiles(files, onFileContent);
  }

  /**
   * Reads every file from the provided array of paths
   * @param {string[]} files
   * @param {onFileContent} onFileContent
   */
  #readFiles(files, onFileContent) {
    files.forEach((fileName) => {
      onFileContent(fileName, fs.readFileSync(fileName, "utf-8"));
    });
  }

  /**
   * Prints the file names and their minified size
   * @param {string} file
   * @param {string} name
   */
  #printSize(file, name) {
    fs.stat(file, (err, stats) => {
      if (err) {
        return console.error(err);
      }
      name = name.substring(name.lastIndexOf("/") + 1);
      /** @param {number} size */
      const round = (size) => +(Math.round(size + "e+2") + "e-2");
      if (stats.size < 1024) {
        console.log(`${name}:\t${stats.size} byte`);
      } else if (stats.size < 1048576) {
        // 1024 * 1024 = 1Mb
        console.log(`${name}:\t${round(stats.size / 1024)} Kb`);
      } else {
        // >1Mb
        console.log(`${name}:\t${round(stats.size / 1048576)} Mb`);
      }
    });
  }
}

module.exports = {
  LetsPack,
};
