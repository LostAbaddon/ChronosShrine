// Common Functions

(root => {
	if (root.UtilInitialized) return;
	root.UtilInitialized = true;

	root.wait = (delay=0) => new Promise(res => setTimeout(res, delay));
	root.now = () => Date.now();
	root.isString = str => (typeof str === 'string') || (str instanceof String);
	root.isNumber = num => ((typeof num === 'number') || (num instanceof Number)) && !isNaN(num);
	root.randomize = array => {
		var isStr = false;
		if (isString(array)) {
			isStr = true;
			array = array.split('');
		}
		var result = [], len = array.length, l = len;
		for (let i = 0; i < len; i ++) {
			result.push(array.splice(Math.floor(Math.random() * l), 1)[0]);
			l --;
		}
		if (isStr) result = result.join('');
		return result;
	};
	root.newID = (len=16) => {
		var str = [];
		for (let i = 0; i < len; i ++) {
			str.push(root.newID.CharList[Math.floor(Math.random() * root.newID.CharList.length)]);
		}
		return str.join('');
	};
	root.newID.CharList = [...('abcdefghijklmnopqrstuvwxyz').split(''), ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789').split('')];

	var MonthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var isLeap = y => {
		if (Math.floor(y / 4) * 4 !== y) return false;
		if (Math.floor(y / 100) * 100 !== y) return true;
		if (Math.floor(y / 400) * 400 !== y) return false;
		return true;
	};

	root.getToday = () => {
		var d = new Date();
		var result = [];
		result[0] = d.getFullYear();
		result[1] = d.getMonth() + 1;
		result[2] = d.getDate();
		result[3] = d.getDay();
		if (result[3] === 0) result[3] = 7;
		return result;
	};
	root.toMonday = (year, month, day) => {
		var d = new Date([year, month, day].join('-'));
		var m = d.getDay();
		if (m === 0) m = 7;
		m --;
		d = d.getTime() - m * 1000 * 3600 * 24;
		d = new Date(d);
		return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
	};
	root.getNextDay = (year, month, day) => {
		var limit = MonthDays[month];
		if (month === 2 && isLeap(year)) limit ++;
		day ++;
		if (day > limit) {
			day = 1;
			month ++;
			if (month > 12) {
				month = 1;
				year ++;
			}
		}
		return [year, month, day];
	};
	root.getWholeWeek = (year, month, day) => {
		var result = [];
		result.push([year, month, day]);
		for (let i = 0; i < 6; i ++) {
			[year, month, day] = root.getNextDay(year, month, day);
			result.push([year, month, day]);
		}
		return result;
	};
	root.getWeeksInMonth = (year, month) => {
		var day = 1;
		var result = [root.toMonday(year, month, day)];
		var limit = MonthDays[month];
		if (month === 2 && isLeap(year)) limit ++;
		while (true) {
			day += 7;
			let m = month;
			let y = year;
			let jump = false;
			if (day > limit) {
				m ++;
				day -= limit;
				jump = true;
				if (m > 12) {
					y ++;
					m -= 12;
				}
			}
			let temp = root.toMonday(y, m, day);
			if (temp[1] !== month) break;
			result.push(temp);
			if (jump) break;
		}
		return result;
	};
	root.getDaysInMonth = (year, month) => {
		var limit = MonthDays[month];
		if (month === 2 && isLeap(year)) limit ++;
		var result = [];
		for (let i = 1; i <= limit; i ++) result.push([year, month, i]);
		return result;
	};
	root.getDateTag = (type, year, month, day) => {
		if (type === 'lifely') return 'life';
		if (type === 'yearly') return year + '';
		if (type === 'monthly') return year + '-' + month;
		return year + '-' + month + '-' + day;
	};
}) (window);