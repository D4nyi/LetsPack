const { minify } = require("terser");
const postcss = require("postcss");
const autoprefixer = require("autoprefixer");
const importer = require("postcss-import");
const csso = require("postcss-csso");
const { writeFile, readFile, readFileSync, readdirSync, stat } = require("fs");
const { resolve, join } = require("path");
const { URL } = require("url");
const { get } = require("https");
const md5 = require("md5-file");

const terserConfig = {
  mangle: true,
  compress: {},
};

/**
 * @callback onFileContent
 * @param {string} fileName the name of the file, without the path and extension
 * @param {string} fileContent the content of the file
 * @returns {void}
 */

/**
 * @class LetsPack
 * Provide a simpler web asset packaging then LaravelMix
 */
class LetsPack {
  /**
   * @type {{css: string|null, js: string|null}}
   */
  #outputFiles = {
    css: null,
    js: null,
  };

  /**
   * Bundles the provided array of scripts or scripts from a directory into one minified file
   * @param {string | string[]} scripts the input files or directory
   * @param {string} output the output file path with file name
   * @return {Promise<this>}
   */
  async scripts(scripts, output) {
    this.#outputFiles.js = output;
    output = resolve(output);

    const codes = {};

    /**
     * @type {onFileContent}
     */
    const cb = (name, content) => {
      codes[name] = content;
    };

    if (Array.isArray(scripts)) {
      this.#readFiles(scripts, cb);
    } else if (typeof scripts === "string") {
      scripts = resolve(scripts);
      this.#readDirectoryFiles(scripts, cb);
    } else {
      throw Error("Uknown type for 'scripts'!");
    }

    const options = await minify(codes, terserConfig);
    this.#writeToFile(output, options.code, this.#outputFiles.js);

    return this;
  }

  /**
   * Processes the provided style with PostCss, PostCss-Import, Autoprefixer and Csso.
   * Because of PostCss-Import you don't need to provide multiple files to create bundles, just add an '@import <path>' tag at begining of your main css.
   * @param {string} style your main css path and name
   * @param {string} output the output file path with file name
   * @return {Promise<this>}
   */
  async styles(style, output) {
    if (typeof style !== "string") {
      throw Error("Uknown type for 'styles'!");
    }

    this.#outputFiles.css = output;
    output = resolve(output);

    style = resolve(style);
    readFile(style, async (err, css) => {
      if (err) {
        return console.error(err);
      }

      try {
        /**
         * @type {{css: string}}
         */
        const result = await postcss([autoprefixer, importer, csso]).process(
          css,
          {
            from: style,
            to: output,
          }
        );
        this.#writeToFile(output, result.css, this.#outputFiles.css);
      } catch (err) {
        return console.error(err);
      }
    });

    return this;
  }

  /**
   * Creates a mix-manifest.json for Laravel to vesion its static files
   * @return {Promise<void>}
   */
  async version() {
    const js = await md5(this.#outputFiles.js);
    const css = await md5(this.#outputFiles.css);
    const mix = {};
    /**
     * @param {string} filePath
     */
    const processFile = (filePath) => {
      if (filePath.includes("\\")) {
        filePath = filePath.replaceAll("\\", "/");
      }

      const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

      if (fileName.endsWith(".js")) {
        mix[`/js/${fileName}`] = `/js/${fileName}?id=${js}`;
      } else {
        mix[`/css/${fileName}`] = `/css/${fileName}?id=${css}`;
      }
    };

    processFile(this.#outputFiles.js);
    processFile(this.#outputFiles.css);

    this.#writeToFile(
      resolve("public/mix-manifest.json"),
      JSON.stringify(mix, null, 4),
      null,
      false
    );
  }

  /**
   * Reads every file from the provided directory
   * @param {string} dirName
   * @param {onFileContent} onFileContent
   */
  #readDirectoryFiles(dirName, onFileContent) {
    const files = readdirSync(dirName, "utf-8").map((file) =>
      join(dirName, file)
    );
    this.#readFiles(files, onFileContent);
  }

  /**
   * Reads every file from the provided array of paths
   * @param {string[]} files
   * @param {onFileContent} onFileContent
   */
  #readFiles(files, onFileContent) {
    files.forEach((file) => {
      this.#isURL(file)
        ? this.#download(file, onFileContent)
        : onFileContent(resolve(file), readFileSync(file, "utf-8"));
    });
  }

  /**
   * Test if the provided string is a valid URL
   * @param {string} link
   * @returns {boolean}
   */
  #isURL(link) {
    try {
      const url = new URL(link);
      return !!url.protocol && "https:" === url.protocol;
    } catch (error) {
      return false;
    }
  }

  /**
   * Downloads a CDN file
   * @param {string} file
   * @param {onFileContent} onFileContent
   */
  #download(file, onFileContent) {
    const name = file.substring(file.lastIndexOf("/") + 1);
    let content = "";
    get(file, (response) => {
      response.addListener("data", (data) => (content += data.toString()));
      response.addListener("end", () => onFileContent(name, content));
    });
  }

  /**
   * Prints the file names and their minified size
   * @param {string} file
   * @param {string} name
   */
  #printSize(file, name) {
    stat(file, (err, stats) => {
      if (err) {
        return console.error(err);
      }
      name = name.substring(name.lastIndexOf("/") + 1) + ":";
      const mod = name.length % 8;
      const indent = mod > 0 ? 8 - mod : 0;
      for (let i = 0; i < indent; i++) {
        name += " ";
      }
      /** @param {number} size */
      const round = (size) => +(Math.round(size + "e+2") + "e-2");
      if (stats.size < 1024) {
        console.log(`${name}\t${stats.size} byte`);
      } else if (stats.size < 1048576) {
        // 1024 * 1024 = 1Mb
        console.log(`${name}\t${round(stats.size / 1024)} Kb`);
      } else {
        // >1Mb
        console.log(`${name}\t${round(stats.size / 1048576)} Mb`);
      }
    });
  }

  /**
   * @param {string} output
   * @param {string|undefined} result
   * @param {string|null} files
   * @param {boolean} printSize
   */
  #writeToFile(output, result, files, printSize = true) {
    writeFile(output, result, (err) => {
      if (err) return console.log(err);
      if (printSize) this.#printSize(output, files);
    });
  }
}

module.exports = { LetsPack };
