export const ENV_PRODUCTION = 'prod';
export const ENV_DEVELOPMENT = 'dev';
export const ENV_TESTING = 'test';

export class EnvironmentService
{
    constructor(env=ENV_PRODUCTION) {
        this.env = env || ENV_PRODUCTION;
    }

    /**
     * Returning current env
     *
     * @returns {String}
     */
    getEnv()
    {
        return this.env;
    }

    /**
     * @returns {boolean}
     */
    isProduction()
    {
        return this.getEnv() === ENV_PRODUCTION;
    }

    /**
     * @returns {boolean}
     */
    isDevelopment()
    {
        return this.getEnv() === ENV_DEVELOPMENT;
    }

    /**
     * @returns {boolean}
     */
    isTesting()
    {
        return this.getEnv() === ENV_TESTING;
    }
}
