/* eslint-disable @typescript-eslint/naming-convention */

interface SourceLine {
    source: string;
    line: number;
}

export interface ConsoleInfo {
    type: string;
    message: string;
    timestamp: number;
    script_source_lines: SourceLine[];
    all_source_lines: SourceLine[];
    stack_trace: string[];
    custom_data?: any;
}