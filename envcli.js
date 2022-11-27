const direct = require.main === module;
const fs = require("fs");
const os = require("os");
const path = require("path");
const NAME = "env" + "cli";
const args = process.argv;
const tmpDir = os.tmpdir();
const envCliPath = path.join(tmpDir, NAME);
let chalk;
let supportsColor = false;
let supportsColorErr = false;
try {
    chalk = require("chalk");
    supportsColor = chalk["supportsColor"];
    supportsColorErr = chalk["supportsColorStderr"];
} catch (e) {
    console.warn("  WARN Couldn't find a stable chalk version you are viewing envcli without colors.\n  You can install chalk by using following command:\n  npm i chalk@4.1.2\n");
    console.error(e);
}
const log = (color, str) => console.log(str ? chalk.hex(color)(str) : (str || color));

const objectCombine = (keys, values) => keys.reduce((obj, key, index) => ({...obj, [key]: values[index]}), {});
const parseEnv = content => {
    const lines = content.split("\n").filter(i => !i.trimStart().startsWith("#") && i.trimStart());
    return objectCombine(lines.map(i => i.split("=")[0]), lines.map(i => i.split("=").slice(1).join("=")));
}
const stringifyEnvFile = json => Object.keys(json).map(k => `${k}=${json[k]}`).join("\n");
const setEnvProperty = (content, key, value) => {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
        let k = lines[i].split("=")[0].trimStart();
        if (k === key) {
            lines[i] = lines[i].split("=")[0] + "=" + value;
            return lines.join("\n");
        }
    }
    return [...lines, `${key}=${value}`].join("\n");
};
const removeEnvProperty = (content, key) => {
    return content.split("\n").filter(i => i.split("=")[0].trimStart() !== key).join("\n");
};
const readFile = file => new Promise(r => fs.readFile(file, (error, data) => error ? r({error}) : r({data})));
module.exports = {
    setEnvProperty, removeEnvProperty, stringifyEnvFile, parseEnv
};
(async () => {
    if (!direct) return;
    const BLUE = "5f5de8";
    const DARK_RED = "851717";
    const RED = "e85d5d";
    const YELLOW = "f0e190";
    const GREEN = "74de6f";
    const arg = args[0].split(".").reverse().slice(1).reverse().join(".").endsWith("node") ? args.slice(2) : args.slice(1);

    const extraArgs = {};
    const parameterAliases = {
        F: "-file",
        K: "-key",
        V: "-value",
        C: "-force"
    };
    const validParameters = ["-file", "-key", "-value", "-force"];
    let cN = null;
    for (let i = 0; i < arg.length; i++) {
        let n = arg[i], nO = n;
        if (n.startsWith("-")) {
            n = n.substring(1);
            n = parameterAliases[n] || n;
            if (!validParameters.includes(n)) return log(DARK_RED, "  ERROR Invalid parameter " + nO);
            cN = n;
            extraArgs[cN] = true;
        } else if (cN) {
            extraArgs[cN] = n;
        }
    }

    if (!fs.existsSync(envCliPath)) fs.mkdirSync(envCliPath);
    if (!fs.existsSync(path.join(envCliPath, ".cache"))) fs.writeFileSync(path.join(envCliPath, ".cache"), "{}");
    const cache = JSON.parse((await readFile(path.join(envCliPath, ".cache"))).data.toString() || "{}");
    const saveCache = () => fs.writeFileSync(path.join(envCliPath, ".cache"), JSON.stringify(cache));
    if (!cache.cache) cache.cache = {};
    cache.cache[__dirname] = cache.cache[__dirname] || {};
    cache.cache[__dirname].FILE = cache.cache[__dirname].FILE || ".env";
    saveCache();
    if (!fs.existsSync(path.dirname(path.join(__dirname, cache.cache[__dirname].FILE)))) cache.cache[__dirname].FILE = ".env";
    const cachedFile = path.join(__dirname, cache.cache[__dirname].FILE);
    if (!fs.existsSync(cachedFile)) {
        if (!extraArgs["-force"] && arg[0] !== "open" && arg[0] !== "help") return log(DARK_RED, "  ERROR Couldn't find the selected environment file:\n  ERROR " + cachedFile + "\n ERROR To force Env CLI to create the file use --force parameter.");
        if (!fs.existsSync(path.dirname(cachedFile))) fs.mkdirSync(path.dirname(cachedFile), {recursive: true});
        fs.writeFileSync(cachedFile, "### ENVIRONMENT FILE ###\n");
    }
    log(BLUE, "\n");
    log(BLUE, "  Selected environment file: " + cachedFile + "");
    const fileAct = extraArgs["-file"] ? path.join(__dirname, extraArgs["-file"]) : cachedFile;
    switch (arg[0]) {
        case "open":
            if (!extraArgs["-file"]) return log(RED, "  ERROR You didn't specify the file.\n  ERROR Usage: envcli open --file .env");
            if (!fs.existsSync(path.join(__dirname, extraArgs["-file"]))) {
                if (!extraArgs["-force"]) return log(RED, "  ERROR Couldn't find the specified file.\n  ERROR To force Env CLI to create file use --force parameter.");
                const f = path.join(__dirname, extraArgs["-file"]);
                if (!fs.existsSync(path.dirname(f))) fs.mkdirSync(path.dirname(f), {recursive: true});
                fs.writeFileSync(f, "### ENVIRONMENT FILE ###\n");
            }
            cache.cache[__dirname].FILE = extraArgs["-file"];
            saveCache();
            log(GREEN, "  Current file has been set to " + path.join(extraArgs["-file"], ""));
            break;
        case "raw":
            log(YELLOW, (await readFile(fileAct)).data.toString());
            break;
        case "set":
            if (typeof extraArgs["-key"] !== "string" || typeof extraArgs["-value"] !== "string") return log(DARK_RED, "  ERROR Wrong usage.\n  ERROR Usage: envcli set --key myKey --value myValue");
            fs.writeFileSync(fileAct, setEnvProperty((await readFile(fileAct)).data.toString(), extraArgs["-key"], extraArgs["-value"]));
            log(GREEN, "  The key \"" + extraArgs["-key"] + "\" has been set to \"" + extraArgs["-value"] + "\"!");
            break;
        case "remove":
            if (typeof extraArgs["-key"] !== "string") return log(DARK_RED, "  ERROR Wrong usage.\n  ERROR Usage: envcli remove --key myKey");
            fs.writeFileSync(fileAct, removeEnvProperty((await readFile(fileAct)).data.toString(), extraArgs["-key"]));
            log(GREEN, "  The key \"" + extraArgs["-key"] + "\" has been removed!");
            break;
        case "get":
            if (typeof extraArgs["-key"] !== "string") return log(DARK_RED, "  ERROR Wrong usage.\n  ERROR Usage: envcli get --key myKey");
            const p = parseEnv((await readFile(fileAct)).data.toString() || "");
            if (!Object.keys(p).includes(extraArgs["-key"])) return log(YELLOW, "  The key \"" + extraArgs["-key"] + "\" doesn't have a value.");
            log(GREEN, "  The key \"" + extraArgs["-key"] + "\"'s value is \"" + p[extraArgs["-key"]] + "\"");
            break;
        case "tree":
            const parsed = parseEnv((await readFile(fileAct)).data.toString() || "");
            const ln = [];
            const longestKey = Object.keys(parsed).sort((a, b) => b.length - a.length)[0].length;
            const longestValue = Object.values(parsed).sort((a, b) => b.length - a.length)[0].length;
            for (let i = 0; i < Object.keys(parsed).length; i++) {
                const key = Object.keys(parsed)[i];
                const value = parsed[key];
                ln.push("  ├─── " + key + " " + ("─".repeat(longestKey - key.length + 3)) + " " + value + " " + ("─".repeat(longestValue - value.length + 3)) + "┤")
            }
            const maxLineLen = ln.map(i => i.length).sort((a, b) => b - a)[0];
            log(YELLOW, "  ┌" + "─".repeat(Math.max(maxLineLen - 4, 5)) + "┐");
            ln.forEach(l => log(YELLOW, l));
            log(YELLOW, "  └" + "─".repeat(Math.max(maxLineLen - 4, 5)) + "┘");
            break;
        default:
            if (!arg[0]) log(RED, "     envcli <command>\n");

            log(DARK_RED, "  Usage:");
            log(RED, "      envcli help    You're here");
            log(RED, "      envcli open    Selects the environment file");
            log(RED, "      envcli tree    Makes a tree of the environment file");
            log(RED, "      envcli raw     Shows the raw content");
            log(RED, "      envcli set     Sets the property");
            log(RED, "      envcli remove  Removes the property");
            log(RED, "      envcli get     Gets the property");

            log(DARK_RED, "\n  Parameters:");
            log(RED, "      --file         Selects the file to act on");
            log(RED, "        OR -F");
            log(RED, "      --key          The key of the property");
            log(RED, "        OR -K");
            log(RED, "      --value        The value of the property");
            log(RED, "        OR -V");
            log(RED, "      --force        Forces the action");
            log(RED, "        OR -C");
            break;
    }
})();