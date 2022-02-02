#!/usr/bin/env node

/**
 * ViaMia - Use your own keyboards with VIA
 * 
 * Thomas Konings - 2022
 * If VIA breaks that's your problem. If you ran this program, don't go complain to the VIA team.
 * I take no responsibility for any issues caused by this tool. Use it at your own risk.
 */

const inquirer = require('inquirer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const asar = require('asar');

const default_url = "http://127.0.0.1:1337";

// TODO: ADD SOME ASCII ART

async function Main(){
    console.log("ViaMia - v0.01");
    console.log("ViaMia allows you to define a custom keyboard JSON collection for VIA to use during startup.");
    console.log("It does so by adjusting a single url in your VIA install. Updates to VIA may break this tool.");
    console.log("If you encounter any issues with VIA after running this tool, do not contact the VIA team. Reinstall VIA.");
    console.log("Important: close VIA before continuing.");
    console.log(" ");

    let {confirmed} = await inquirer.prompt([
        {type: "confirm", name: "confirmed", "message": "I understand what I'm doing", default: true}
    ]);

    if(confirmed == false){ process.exit(0); }

    // Detecting user homedir
    let homedir = os.homedir();

    // Look for VIA install
    // TODO: make autodetection work on Mac & Linux
    let platform = os.platform();
    let possiblePath;
    if(platform == "win32"){
        possiblePath = path.join(homedir,"AppData","Local","Programs","via");
    }

    let viaPath;
    if(possiblePath != undefined){
        if(fs.existsSync(possiblePath)){
            viaPath = possiblePath;
        }
    }

    // Autodetection failed ask for directory
    if(viaPath == undefined){
        console.log("Autodetection of the VIA install directory failed.");
        let {usrPath} = await inquirer.prompt([
            {type: "input", name: "usrPath", "message": "Please enter the path manually"}
        ]);

        if(fs.existsSync(usrPath)){
            viaPath = usrPath;
        }else{
            console.log("Path not found.");
            process.exit(0);
        }
    }

    // We now have a viaPath that's always defined
    console.log("VIA install found in: "+viaPath);
    let resources = path.join(viaPath, "resources");
    let app_asar = path.join(resources, "app.asar");

    // Check if app.asar exists
    let exists = fs.existsSync(app_asar);
    if(!exists){ console.log("app.asar resources could not be found. Perhaps VIA was updated."); process.exit(0); }

    // Backup app.asar
    fs.copyFileSync(app_asar, path.join(resources, "app.asar.bac"));
    console.log("Created a backup of the original VIA resources.");

    // Unpack asar
    console.log("Unpacking resources from ASAR (this may take a while).");
    let unpacked_dir = path.join(resources, 'app_unpacked');
    await asar.extractAll(app_asar, unpacked_dir);
    console.log("ASAR unpacked.");

    // Locate target file
    let targets = [];
    targets.push(path.join(unpacked_dir, "app", "main.prod.js"));
    targets.push(path.join(unpacked_dir, "app", "dist", "renderer.prod.js"));
    targets.forEach(x => {
        if(!fs.existsSync(x)){ console.log(`Target file ${x} could not be found. Perhaps VIA was updated.`); process.exit(0); }
    });

    let {replaceWith} = await inquirer.prompt([
        {"type": "input", "name": "replaceWith", "message": "Replace VIA url with", "default": default_url}
    ]);

    // TODO: CHECK URL VALIDITY

    for(const target of targets){
        await fileContentReplace(target, "https://www.caniusevia.com", replaceWith);
    };
    console.log("All target files modified.");

    // Delete the original ASAR and pack the unpacked directory
    console.log("Repacking ASAR. Almost done.");
    fs.rmSync(app_asar);
    await asar.createPackage(unpacked_dir, app_asar);
    console.log("ASAR repacked. Cleaning up.");

    // Clean up unpacked files
    fs.rmdirSync(unpacked_dir, {recursive: true});

    console.log("Mod done, ViaMia out.");

}

async function fileContentReplace(file, replace, replaceWith){
    console.log("Reading file: "+file);
    let contents = (await fs.promises.readFile(file)).toString();
    contents = contents.replace(replace, replaceWith);
    await fs.promises.writeFile(file, contents);
    console.log("Modded file: "+file);
}

Main();