import * as constants from './constants';
import * as path from 'path';
import * as fs from 'fs';
import { isNull } from 'underscore';
import { EnvironmentService } from './env'

/**
 * Configuration methods to provide read-only configurations from application and connected bundles
 * All the configurations are compiled to one big configuration file.
 * Bundles can rewrite parent configurations
 */
class AbstractConfigResolver
{
    /**
     * @param env {EnvironmentService}
     */
    constructor(env) {

        this.env = env;

        // Final compiled config
        this.config = {};

        // Cache for requested config paths
        this.configPathsCache = {};

        // Cache to store bundles folders paths
        this.bundlesFoldersPathsCache = {};
    }

    /**
     * Iterating over all the configuration and returning any value.
     * If no value exists in configuration by it's path, default value is returned.
     *
     * Example:
     *
     *      {
     *          "http": {
     *              "port": 8000
     *          }
     *      }
     *
     * Code:
     *
     *      this.container.config.get('http.port', 3000);
     *      // Returns 3000 if {http: {port: ...}} doesn't exists in configuration.
     *
     * Configuration is normalised, it means that if in some bundle configuration
     * there's key with dot inside, it will become an object. It can give guarantees that
     * keys defined with different ways but with the same final path - will have the same value.
     *
     * Not normalised config:
     *
     *      {
     *          "a.b": {
     *              "c": 1
     *          }
     *      }
     *
     * Normalised config:
     *
     *      {
     *          "a" {
     *              "b": {
     *                  "c": 1
     *              }
     *          }
     *      }
     *
     * Method actively uses cache for configPath, so every config request wouldn't followed with a lot
     * of iterations and speed slowness.
     *
     * In development mode configuration cache is not used to return values.
     *
     * @param configPath
     * @param configDefault
     * @returns {*}
     */
    get(configPath=null, configDefault=null)
    {
        if (this.configPathsCache.hasOwnProperty(configPath) && !this.container.isDevelopment()) {
            return this.configPathsCache[configPath];
        }

        let initialConfigPath = Object.copy(configPath);
        configPath = configPath ? configPath.split('.') : [];
        let configCopy = Object.copy(this.config);

        if (configPath.length) {

            for (let i = 0; i < configPath.length; i++) {

                let configPart = configPath[i];

                if (!configCopy.hasOwnProperty(configPart)) {
                    this.configPathsCache[initialConfigPath] = configDefault;
                    return configDefault;
                }
                configCopy = configCopy[configPart];
            }
        }

        this.configPathsCache[initialConfigPath] = configCopy;
        return configCopy;
    }

    /**
     * Checks if config exists in configuration.
     * If config exists but has been sat to null - then method returns `false` as well.
     *
     * @param configPath
     * @returns {boolean}
     */
    has(configPath=null)
    {
        return this.get(configPath) !== null;
    }

    compile(config)
    {
        // TODO: include additional configs by "include"
        // TODO: normalise config
        // TODO: append to this.config with deep replacement
        console.log('compiling some config');
    }

    /**
     * Returns config path for:
     * 1) relative configs
     * 2) application configs
     * 3) other bundles configs
     *
     * @param configFileName
     * @param bundleName
     * @param useEnv
     * @returns {*}
     */
    getConfigFilePath(
        configFileName,
        bundleName='app',
        useEnv=true
    ) {

        // Environment specified config
        if (useEnv) {
            configFileName += '_' + this.env.getEnv();
        }

        // Extension added
        configFileName += '.' + this.getExtension();

        // Bundle name specified
        if (bundleName) {

            // This is application config
            if (bundleName === 'app') {
                return path.join(this.getAppPath(), constants.CONFIGS_FOLDER, configFileName);
            }

            // Or this is third-party config
            return path.join(this.getBundleFolderPath(bundleName), constants.CONFIGS_FOLDER, configFileName);
        }

        // Bundle name is not specified, it means that config path is relative
        return path.join(constants.CONFIGS_FOLDER, configFileName);
    }

    /**
     * Returning base folder of bundle which suppose to be included or used
     *
     * @param bundleName
     * @returns String
     */
    getBundleFolderPath(bundleName)
    {
        if (this.bundlesFoldersPathsCache.hasOwnProperty(bundleName)) {
            return this.bundlesFoldersPathsCache[bundleName];
        }
        this.bundlesFoldersPathsCache[bundleName] = path.dirname(require.resolve(bundleName));
        return this.bundlesFoldersPathsCache[bundleName];
    }

    /**
     * Reading configuration raw data from the app folder.
     * I can be useful when we need simply iterate on dependencies without compiling configurations
     *
     * @param configName
     * @returns {*}
     */
    getAppRawConfig(configName)
    {
        let configFilePath = this.getConfigFilePath(configName, 'app');

        // ENV-specified config
        let config = this.readConfig(configFilePath);

        // No env-specified - reading config without env postfix
        if (isNull(config)) {
            configFilePath = this.getConfigFilePath(configName, 'app', false);
            config = this.readConfig(configFilePath);
        }
        console.log(config);
        return config || {};
    }

    /**
     * Getting root project path.
     * It includes app, web, src folders
     *
     * @returns String
     */
    getRootPath()
    {
        return process.cwd();
    }

    /**
     * Returns app/ full path, it's the place where common application path configurations
     * and cache and other useful application stuff exists
     *
     * @returns String
     */
    getAppPath()
    {
        return path.join(this.getRootPath(), 'app');
    }

    /**
     * Returns web/ path, the place where all the static files are compiled
     *
     * @returns String
     */
    getWebPath()
    {
        return path.join(this.getRootPath(), 'web');
    }

    /**
     * Retunrs src/ path, where all the application's bundles are
     *
     * @returns String
     */
    getSrcPath()
    {
        return path.join(this.getRootPath(), 'src');
    }

    /**
     * Reading and returning configuration file contents
     *
     * @param configFileName
     * @returns {*}
     */
    readConfig(configFileName)
    {
        throw new Error('AbstractConfigResolver::readConfig should be implemented in child classes');
    }

    /**
     * @returns String
     */
    getExtension()
    {
        throw new Error('AbstractConfigResolver::getExtension should be implemented in child classes')
    }
}

/**
 * Provides basic configuration functionality.
 * For more details please read documentation for AbstractConfigResolver
 */
export class JsonConfigResolverService extends AbstractConfigResolver
{
    /**
     * @param configFileName
     * @returns {null}
     */
    readConfig(configFileName)
    {
        try {
            if (fs.statSync(configFileName).isFile()) {
                return JSON.parse(fs.readFileSync(configFileName));
            }
        } catch (e) {
            return null;
        }
    }

    getExtension()
    {
        return 'json';
    }
}
