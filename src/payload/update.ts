/* eslint-disable @typescript-eslint/naming-convention */

export interface Update {
    type: string;
    total: number;
    successful: number;
    errors: number;
    warnings: number;
    time: number;
}