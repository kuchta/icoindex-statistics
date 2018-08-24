import moment from 'moment';

export function humanizeDuration(time: number) {
	const duration = moment.duration(time);
	if (duration.years()) {
		return `${duration.years()} years and ${duration.months()} months`;
	} else if (duration.months()) {
		return `${duration.months()} months and ${duration.days()} days`;
	} else if (duration.days()) {
		return `${duration.days()} days and ${duration.hours()} hours`;
	} else if (duration.hours()) {
		return `${duration.hours()} hours and ${duration.minutes()} minutes`;
	} if (duration.minutes()) {
		return `${duration.minutes()} minutes and ${duration.seconds()} seconds`;
	} if (duration.seconds()) {
		return `${duration.seconds()} seconds and ${Math.round(duration.milliseconds())} ms`;
	} else {
		return `${duration.milliseconds()} ms`;
	}
}
