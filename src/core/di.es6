import { JsonConfigResolverService } from './config';
import { BundlesResolverService } from './bundles';
import { EnvironmentService } from './env';
import * as path from 'path';
import * as fs from 'fs';
import { isNull } from 'underscore';


export class DependencyManagerService
{
    /**
     * @param bundlesResolverService {BundlesResolverService}
     */
    constructor(bundlesResolverService) {
        this.bundlesResolverService = bundlesResolverService;
        this.bundlesResolved = false;
        this.services = {};
    }

    /**
     * Getting instance of the service
     *
     * @param service
     * @returns {*}
     */
    get(service)
    {
        if (!this.services.hasOwnProperty(service)) {
            this.services[service] = this.resolve(service);
        }
        return this.services[service];
    }

    resolve(service)
    {
        if (false === this.bundlesResolved) {
            this.bundlesResolverService.buildBundlesTree();
            this.bundlesResolved = true;
        }

        return 'hello' + service;
    }
}