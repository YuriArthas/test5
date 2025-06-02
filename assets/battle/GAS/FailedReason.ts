export class FailedReason {

}

export class SimpleFailedReason extends FailedReason {
    msg: string;
    constructor(public reason: string) {
        super();
        this.msg = reason;
    }
}

export class FailedReasonContainer {
    value: FailedReason;
}


