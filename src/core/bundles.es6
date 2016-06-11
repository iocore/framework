import * as constants from './constants';
import * as path from 'path';
import * as fs from 'fs';
import { isNull, isFunction } from 'underscore';
import { JsonConfigResolverService } from './config';
import { DependencyManagerService } from './di';

export class BundlesResolverService
{
    /**
     * @param configResolverService {JsonConfigResolverService}
     */
    constructor(configResolverService) {
        this.configResolverService = configResolverService;
        this.bundlesTree = [];
        this.bundlesCache = {};
        this.kernelListeners = {};
        this.dependencyManagerService = null;
    }

    /**
     * Setting up dependency manager service to use it during bootstrap dependencies
     * resolving.
     *
     * @param dependencyManagerService {DependencyManagerService}
     */
    setDependencyManager(dependencyManagerService)
    {
        this.dependencyManagerService = dependencyManagerService;
        return this;
    }

    /**
     * Returns linear view of bundles tree.
     *
     * @returns {Array}
     */
    getTree()
    {
        if (!this.bundlesTree.length) {
            this.buildBundlesTree();
        }
        return this.bundlesTree;
    }

    /**
     * Build full bundles tree by the order of their dependencies,
     * so when iterate over all of them by linear order - all of the needed
     * dependencies will be properly resolved.
     *
     * Application's configuration from app/config/config.json will be
     * the last in this list, so third-party bundles configurations
     * could be changed/rewritten by application.
     *
     * Example of such structure:
     *
     *      [
     *          { bundle: 'iocore/bundles/cookie-parser', deps: [] },
     *          { bundle: 'iocore/bundles/body-parser',
     *              deps: [ 'iocore/bundles/cookie-parser' ] },
     *          { bundle: 'bundles/shop', deps: [] },
     *          { bundle: '/Users/JohnDoh/Projects/application/app',
     *              deps: [ 'iocore/bundles/body-parser', 'bundles/shop' ] }
     *      ]
     *
     * @returns {BundlesResolverService}
     */
    buildBundlesTree()
    {
        let rootDeps = this.configResolverService.getAppRawConfig('deps').dependencies || [];

        if (!rootDeps.length) {
            return this;
        }

        rootDeps.forEach((dependencyBundle) => {
            this.iterateOverBundles(dependencyBundle, (bundleName) => {
                if (!this.haveBundleInTree(bundleName)) {
                    let dependencies = this.getBundleDependencies(bundleName);
                    this.bundlesTree.push({
                        bundle: bundleName,
                        deps: dependencies
                    });
                }
            });
        });

        // As application configuration can rewrite dependencies configurations,
        // it should be the last
        this.bundlesTree.push({
            bundle: this.configResolverService.getAppPath(),
            deps: rootDeps
        });

        return this;
    }

    /**
     * Recursively iterate on bundle's dependencies (other bundles)
     * and call provided callback on each.
     *
     * Very useful function to go over dependencies by their priorities and execute
     * needed callback with custom functionality.
     *
     * Second argument is required to be `function` callback
     *
     * @param bundleName {String}
     * @param bundleInstanceCallback {function}
     * @throws Error
     */
    iterateOverBundles(bundleName, bundleInstanceCallback)
    {
        let dependencies = this.getBundleDependencies(bundleName);

        dependencies.forEach(dependency => {
            this.iterateOverBundles(dependency, bundleInstanceCallback);
        });

        if (!isFunction(bundleInstanceCallback)) {
            throw new Error(`Second argument for "iterateOverBundles" should be function, got ${bundleInstanceCallback}`);
        }

        bundleInstanceCallback(bundleName);
    }

    /**
     * Iterate over all the bundles by priority order
     * and add it's main configuration `config[_env].json` to the root config of application.
     *
     * @returns {BundlesResolverService}
     */
    compileConfigurations()
    {
        this.bundlesTree.forEach((dependency) => {
            let config = this.configResolverService.readConfig(
                this.configResolverService.getConfigFilePath('config', dependency.bundle)
            );
            if (isNull(config)) {
                config = this.configResolverService.readConfig(
                    this.configResolverService.getConfigFilePath('config', dependency.bundle, false)
                );
            }
            if (!isNull(config)) {
                this.configResolverService.compile(config);
            }
        });
        return this;
    }

    /**
     * Get bundle dependencies array
     *
     * @param bundleName {String}
     * @returns {Array}
     */
    getBundleDependencies(bundleName)
    {
        let configFilePath = this.configResolverService.getConfigFilePath('deps', bundleName);
        let dependencies = this.configResolverService.readConfig(configFilePath);

        if (isNull(dependencies) || !dependencies.dependencies) {

            // Dependencies from dependencies_{env}.json is empty
            // Trying to read dependencies.json (production one)
            configFilePath = this.configResolverService.getConfigFilePath('deps', bundleName, false);
            dependencies = this.configResolverService.readConfig(configFilePath);

            if (isNull(dependencies) || !dependencies.dependencies) {
                dependencies = {dependencies: []};
            }
        }
        return dependencies.dependencies;
    }

    /**
     * Find out if dependency already exists in tree
     *
     * @param dependency {String}
     * @returns {boolean}
     */
    haveBundleInTree(dependency)
    {
        for (let i = 0; i < this.bundlesTree.length; i++) {
            if (this.bundlesTree[i].bundle === dependency) {
                return true;
            }
        }
        return false;
    }

    /**
     * Require all bundles bootstrap classes and instantiate them.
     * Call `subscribeBundleToKernelEvents` method to subscribe bundles to kernel events
     * TODO: use dependencyManagerService to inject services to bootstrap constructors
     *
     * @returns {BundlesResolverService}
     */
    bootstrapBundles()
    {
        this.bundlesTree.forEach((dependency) => {
            this.iterateOverBundles(dependency.bundle, (bundleName) => {
                if (this.isBundleBootstrapped(bundleName)) {
                    return this;
                }

                let bundleInstance = require(bundleName);

                // Bootstrap is not required for bundles
                if (!bundleInstance.Bootstrap) {
                    return this;
                }

                this.bundlesCache[bundleName].bootstrapInstance = new bundleInstance.Bootstrap(this);
                this.subscribeBundleToKernelEvents(bundleName);
            });
        });
        return this;
    }

    /**
     * Returning array of event listeners registered to specified event type.
     *
     * @param event {String}
     * @returns {Array}
     */
    getEventListeners(event)
    {
        if (this.kernelListeners.hasOwnProperty(event)) {
            return this.kernelListeners[event];
        }
        return [];
    }

    /**
     * Subscribing bundle to kernel events.
     * Subscription means only saving all the callbacks by their priority and event type.
     * So when needed event will come - we could iterate on callbacks by this event type
     * from highest priority to lowest.
     *
     * @param bundleName {String}
     * @returns {BundlesResolverService}
     */
    subscribeBundleToKernelEvents(bundleName)
    {
        if (!this.bundlesCache[bundleName].bootstrapInstance.onKernelEventsSubscribe
            || !isFunction(this.bundlesCache[bundleName].bootstrapInstance.onKernelEventsSubscribe)
        ) {
            throw new Error(`Bootstrap class in bundle ${bundleName} should be inherited from iocore/core/bootstrap class`);
        }

        let kernelSubscriptions = this.bundlesCache[bundleName].bootstrapInstance.onKernelEventsSubscribe();

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
     * @param bundleName {String}
     * @returns {boolean}
     */
    isBundleBootstrapped(bundleName)
    {
        this.checkBundleInCache(bundleName);
        return this.bundlesCache[bundleName].hasOwnProperty('bootstrapInstance');
    }

    /**
     * @param bundleName {String}
     */
    checkBundleInCache(bundleName)
    {
        if (!this.bundlesCache[bundleName]) {
            this.bundlesCache[bundleName] = {};
        }
    }
}
