/**
 * @class LetsPack
 * Provide a simpler web asset packaging then LaravelMix
 */
export class LetsPack {
    /**
     * Bundles the provided array of scripts or scripts from a directory into one minified file
     * @param {string | string[]} scripts the input files or directory
     * @param {string} output the output file path with file name
     * @return {Promise<this>}
     */
    scripts(scripts: string | string[], output: string): Promise<this>;
    /**
     * Processes the provided style with PostCss, PostCss-Import, Autoprefixer and Csso.
     * Because of PostCss-Import you don't need to provide multiple files to create bundles, just add an '@import <path>' tag at begining of your main css.
     * @param {string} style your main css path and name
     * @param {string} output the output file path with file name
     * @return {Promise<this>}
     */
    styles(style: string, output: string): Promise<this>;
    /**
     * Creates a mix-manifest.json for Laravel to vesion its static files
     * @return {Promise<void>}
     */
    version(): Promise<void>;
}
