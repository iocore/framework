'use strict';

import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { EventEmitter } from 'events';
import { first, last, initial } from 'underscore';
import { green, red } from 'colors';
import * as moment from 'moment';
import * as constants from './core/constants';

/**
 * Main framework class
 */
export class ioCore extends EventEmitter {

    /**
     * Framework core constructor
     *
     * @param env Application environment
     * @param cwd Application root folder
     * @param args
     */
    constructor(env, cwd, ...args) {
        super(...args);
        this.env = env || constants.ENV_PRODUCTION;
        this.cwd = cwd || process.cwd();
        this.modulesCache = {};
        this.commandsClassesInstancesCache = {};
        this.kernelListeners = {};
        this.httpServer = null;
        this.httpsServer = null;
    }

    /**
     * Initializing kernel logic
     *
     * @returns {ioCore}
     */
    bootstrap() {
        // Registering module recursive process starts
        // from current working folder, which should be
        // app's folder
        this.registerModules(this.cwd);
        this.runKernelEvent(constants.KERNEL_EVENT_MODULES_REGISTERED);


        this.runKernelEvent(constants.KERNEL_EVENT_SERVER_READY);
        // TODO: fire pre and post dispatch events
        return this;
    }

    /**
     * Starting servers and making forks
     *
     * @returns {ioCore}
     */
    listen() {

        // Initialising HTTP server
        let httpSettings = {
            port: 3000
        };
        this.runKernelEvent(constants.KERNEL_EVENT_HTTP_SERVER_SETTINGS_READY, httpSettings);
        this.httpServer = http.createServer(this.dispatcher).listen(httpSettings.port);
        this.runKernelEvent(constants.KERNEL_EVENT_HTTP_SERVER_READY, this.httpServer);

        // Initialising HTTPS server
        // TODO: if certificate has been specified, listen to 443 too
        /*let httpsSettings = {
         port: 443,
         serverOptions: {}
         };

         this.runKernelEvent(constants.KERNEL_EVENT_HTTPS_SERVER_SETTINGS_READY, httpsSettings);

         this.httpsServer =
         https.createServer(httpsSettings.serverOptions, this.dispatcher)
         .listen(httpsSettings.port);

         this.runKernelEvent(constants.KERNEL_EVENT_HTTPS_SERVER_READY, httpsSettings);*/
        // TODO: deal with workers

        return this;
    }

    /**
     * Main core dispatcher
     *
     * Receives request and response objects
     *
     * Runs installed middlewares globally or depending of the request information (URI, method, etc)
     * After this runs Module-Controller-Action depending of the request information
     * Collects returned response from controller-action and depending of it's contents understands what to do:
     *  1) if it is regular Response class returned then it should be html/...
     *  2) if it is XMLResponse, JSONResponse, NotFoundResponse etc - then perform needed content type
     *  3) if helper function of the controller class was used: this.render(), this.echo(), then ...
     *  4) Controller class will have for sure following methods:
     *      - getRequest() (getHeaders(), getCookie(s), get..)
     *      - getResponse() (setHeader(s), setCookie(), set..)
     *  5) Controller can throw exception, then depending of exception we'll set response code and render template
     *
     * @param req
     * @param res
     */
    dispatcher(req, res) {
        // TODO: pre-dispatch hook
        // TODO: run middlewares arranged by priorities
        // TODO: instantiate request and response singletones
        // TODO: check what URL and other request information
        // TODO: find Module-Controller-Action situated for request
        // TODO: if not found Module-Controller-Action then show 404 page
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World\n');

        // TODO: post-dispatch hook
    }

    isModuleBootstrapped(moduleName) {
        this.checkModuleInCache(moduleName);
        return this.modulesCache[moduleName].hasOwnProperty('bootstrapInstance');
    }

    /**
     * Recursively registering modules
     *
     * @param moduleName
     * @returns {ioCore}
     */
    registerModules(moduleName) {
        if (this.isModuleBootstrapped(moduleName)) {
            return this;
        }

        let dependencies = this.getModuleDependencies(moduleName);

        dependencies.forEach(dependency => {
            this.registerModules(dependency);
        });

        console.log('Registering module: ', moduleName);

        let moduleInstance = require(moduleName);

        if (!moduleInstance.Bootstrap) {
            throw Error('Module `' + moduleName + '` does not seems like a valid module, Bootstrap object expected');
        }

        this.modulesCache[moduleName]['bootstrapInstance'] = new moduleInstance.Bootstrap(this);

        this.subscribeModuleToKernelEvents(moduleName);

        // TODO: read and compile configuration
        // TODO: setup views folder
        // TODO: setup routes (params, controllers, views)

        return this;
    }

    iterateOverModules(moduleName, moduleInstanceCallback) {
        // TODO: iterate over modules to get commands, or assetics, or configs
    }

    /**
     * Subscribing specified module by it's name to desired events with needed priority
     *
     * @param moduleName
     * @returns {ioCore}
     */
    subscribeModuleToKernelEvents(moduleName) {
        let kernelSubscriptions = this.modulesCache[moduleName]['bootstrapInstance'].onKernelEventsSubscribe();

        Reflect.ownKeys(kernelSubscriptions).forEach((eventName) => {
            let eventData = kernelSubscriptions[eventName];
            let priority = eventData.priority || constants.PRIORITY_NORMAL;

            if (!this.kernelListeners.hasOwnProperty(eventName)) {
                this.kernelListeners[eventName] = {};
            }

            if (!this.kernelListeners[eventName].hasOwnProperty(priority)) {
                this.kernelListeners[eventName][priority] = [];
            }
            this.kernelListeners[eventName][priority].push(eventData);
        });
        return this;
    }

    /**
     * Removing all existing kernel listeners
     *
     * @returns {ioCore}
     */
    clearKernelListeners() {
        this.kernelListeners = {};
        return this;
    }

    runKernelEvent(eventName, ...args) {
        if (!this.kernelListeners[eventName]) {
            return;
        }

        for (let priority = constants.PRIORITY_HIGHEST; priority <= constants.PRIORITY_LOWEST; priority++) {
            let eventSubscribers = this.kernelListeners[eventName][priority] || [];
            eventSubscribers.forEach((subscriber) => {
                if (subscriber.callback && typeof subscriber.callback === 'function') {
                    subscriber.callback(...args);
                }
            });
        }
    }

    /**
     * Creates empty cache object for moduleName if not exists
     *
     * @param moduleName
     */
    checkModuleInCache(moduleName) {
        if (!this.modulesCache[moduleName]) {
            this.modulesCache[moduleName] = {};
        }
    }

    /**
     * Returning base folder of module which suppose to be included or used
     *
     * @param moduleName
     * @returns String
     */
    getModuleFolder(moduleName) {
        this.checkModuleInCache(moduleName);
        if (!this.modulesCache[moduleName]['baseFolder']) {
            this.modulesCache[moduleName]['baseFolder'] = path.dirname(require.resolve(moduleName));
        }
        return this.modulesCache[moduleName]['baseFolder'];
    }

    /**
     * Returns config filename regarding the environment
     * Default configuration file is `config` with extension `.json`
     *
     * Configuration files contains strongly json raw data
     * To not bring logic into configuration
     *
     * @param configFileName
     * @param extension
     * @returns {*}
     */
    getConfigFilename(configFileName = 'config', extension = constants.DEFAULT_CONFIG_EXT) {
        if (this.env !== constants.ENV_PRODUCTION) {
            configFileName += '_' + this.env;
        }
        configFileName += extension;
        return path.join(constants.CONFIGS_FOLDER, configFileName);
    }

    /**
     * Getting module config contents as JSON
     *
     * @param moduleName
     * @param configFileName
     * @param extension
     * @returns {{}|*}
     */
    getModuleConfig(moduleName, configFileName = 'config', extension = constants.DEFAULT_CONFIG_EXT) {
        let baseFolder = this.getModuleFolder(moduleName);
        let configFilePath = path.join(baseFolder, this.getConfigFilename(configFileName, extension));
        return ioCore.readModuleConfigJson(configFilePath);
    }

    /**
     * Reading json data from config file
     *
     * @param configFileName
     * @returns {*}
     */
    static readModuleConfigJson(configFileName) {
        try {
            return JSON.parse(fs.readFileSync(configFileName));
        } catch (e) {
            return {};
        }
    }

    /**
     * Returns contents of module config bootstrap section
     *
     * @returns Object
     */
    getModuleDependencies(moduleName) {
        return this.getModuleConfig(moduleName).dependencies || [];
    }

    /**
     * Registering CLI commands from every module
     *
     * @returns Object
     */
    registerModuleCommands(moduleName) {

    }

    /**
     * Running command and returning result
     *
     * Example of command:
     *      >iocore iocore:server:run       // internal framework command
     *      >iocore iocore-assetic:dump     // other installed module command
     *
     * @param command
     * @returns {}
     */
    runCommand(command, ...args) {
        command = this.getCommandInstance(command);
        let commandMethod = command.classInstance[command.method];
        return commandMethod.bind(command.classInstance)(...args);
    }

    /**
     * Getting instance of command
     *
     * @param command
     * @returns {*}
     */
    getCommandInstance(command) {
        try {
            let commandSections = command.split(':');
            commandSections.splice(1, 0, 'commands');
            let commandMethodName = last(commandSections);

            // If we have class instance cached then it's enough for us to return
            if (this.commandsClassesInstancesCache.hasOwnProperty(command)) {
                return {
                    method: commandMethodName,
                    classInstance: this.commandsClassesInstancesCache[command]
                }
            }

            commandSections = initial(commandSections);
            let commandFileName = last(commandSections);
            let commandClass = commandFileName.charAt(0).toUpperCase()
                + commandFileName.substring(1).toLowerCase() + 'Command';

            let commandPath = commandSections.join(path.sep);
            let commandModule = require(commandPath);

            // Caching command class instance
            this.commandsClassesInstancesCache[command] = new commandModule[commandClass]().setContainer(this);

            return {
                method: commandMethodName,
                classInstance: this.commandsClassesInstancesCache[command]
            }
        } catch (e) {
            throw new Error('Command not found: ' + command + ': ' + e.message);
        }
    }

    /**
     * Getting command information to write it when user requesting help over commands
     *
     * @param command
     */
    getCommandInfo(command) {

    }
}
