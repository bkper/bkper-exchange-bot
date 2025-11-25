import { Bkper } from 'bkper-js';

type Env = Record<string, string | undefined>;

export class AppContext {
    public bkper: Bkper;
    public env: Env;

    constructor(bkper: Bkper, env: Env) {
        this.bkper = bkper;
        this.env = env;
    }
}
