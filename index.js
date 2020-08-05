var now = new Date();

// 数据通讯

const Responsors = {};
const Waiters = {};
chrome.runtime.onMessage.addListener(msg => {
	if (!msg.ok) {
		console.error('Backend Error: ' + msg.event + ' : ' + msg.data);
		return;
	}
	var event = msg.event;
	if (!event) {
		console.error('Event could not be empty!');
		return;
	}
	var cb = Responsors[event];
	if (!cb) {
		console.error('Fontend Error: ' + event + ' : No such responsor!');
		return;
	}
	cb(msg.data);
});

Responsors.getTaskList = data => {
	var tag = data.type + ':' + (data.year || '0') + '-' + (data.month || '0') + '-' + (data.day || '0') + ':' + data.onlynotdone;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res(data.tasks));
};
Responsors.addNewTask = data => {
	var tag = data.type + ':' + (data.year || '0') + '-' + (data.month || '0') + '-' + (data.day || '0') + ':' + data.task + '>>' + data.score;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res());
};
Responsors.changeTaskStatus = data => {
	var tag = data.type + ':' + data.id + '>>' + data.status;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res());
};
Responsors.getPageInfo = data => {
	var tag = 'PAGEINFO:' + data.year + '-' + data.month;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res(data));
};
Responsors.removeTask = data => {
	var tag = 'DELETE::' + data.type + ':' + (data.year || '0') + '-' + (data.month || '0') + '-' + (data.day || '0') + ':' + data.id;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res());
};
Responsors.modifyTask = data => {
	var tag = 'MODIFY::' + data.type + ':' + (data.year || '0') + '-' + (data.month || '0') + '-' + (data.day || '0') + ':' + data.id + ':' + data.task + '>>' + data.score;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res());
};
Responsors.exportAll = data => {
	var blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'text/plain' });
	var link = URL.createObjectURL(blob);
	var downloader = document.createElement('a');
	downloader.setAttribute('href', link);
	downloader.setAttribute('download', 'ChronosShrine.json');
	downloader.click();
};
Responsors.getAppendix = data => {
	var tag = 'APPENDIX::' + data.type + ':' + (data.year || '0') + '-' + (data.month || '0') + '-' + (data.day || '0') + ':' + data.id;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res(data.appendix));
};
Responsors.setAppendix = data => {
	var tag = 'APPENDIX::' + data.type + ':' + (data.year || '0') + '-' + (data.month || '0') + '-' + (data.day || '0') + ':' + data.id;
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res());
};
Responsors.getAll = data => {
	var tag = 'GETALL';
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res(data));
};
Responsors.getTimeUsage = data => {
	var tag = 'GETTIMEUSAGE';
	var cbs = Waiters[tag];
	if (!cbs || !cbs.length) return;
	delete Waiters[tag];
	cbs.forEach(res => res(data));
};

// 数据相关

const getData = (year, month) => new Promise(res => {
	var tag = 'PAGEINFO:' + year + '-' + month;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'getPageInfo', year, month });
});
const getTaskList = (type, year, month, day, onlynotdone) => new Promise(res => {
	var tag = type + ':' + (year || '0') + '-' + (month || '0') + '-' + (day || '0') + ':' + onlynotdone;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'getTaskList', type, year, month, day, onlynotdone });
});
const addNewTask = (type, year, month, day, event, score, done=false, appendix) => new Promise(res => {
	var tag = type + ':' + (year || '0') + '-' + (month || '0') + '-' + (day || '0') + ':' + event + '>>' + score;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'addNewTask', type, year, month, day, task: event, score, done, appendix });
});
const changeTaskStatus = (type, year, month, day, id, status) => new Promise(res => {
	var tag = type + ':' + id + '>>' + status;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'changeTaskStatus', type, year, month, day, id, status });
});
const removeTask = (type, year, month, day, id) => new Promise(res => {
	var tag = 'DELETE::' + type + ':' + (year || '0') + '-' + (month || '0') + '-' + (day || '0') + ':' + id;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'removeTask', type, year, month, day, id });
});
const modifyTask = (type, year, month, day, id, event, score) => new Promise(res => {
	var tag = 'MODIFY::' + type + ':' + (year || '0') + '-' + (month || '0') + '-' + (day || '0') + ':' + id + ':' + event + '>>' + score;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'modifyTask', type, year, month, day, id, task: event, score });
});
const getAppendix = (type, year, month, day, id) => new Promise(res => {
	var tag = 'APPENDIX::' + type + ':' + (year || '0') + '-' + (month || '0') + '-' + (day || '0') + ':' + id;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'getAppendix', type, year, month, day, id });
});
const setAppendix = (type, year, month, day, id, appendix) => new Promise(res => {
	var tag = 'APPENDIX::' + type + ':' + (year || '0') + '-' + (month || '0') + '-' + (day || '0') + ':' + id;
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'setAppendix', type, year, month, day, id, appendix });
});
const getAll = () => new Promise(res => {
	var tag = 'GETALL';
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'getAll' });
});
const readFile = () => {
	if (uploader.length < 1) return;
	var file = uploader.files[0];
	if (!file) return;

	var reader = new FileReader();
	reader.onload = async () => {
		var json = reader.result;
		if (!json) return;
		try {
			json = JSON.parse(json);
		}
		catch {
			return;
		}
		if (!(json instanceof Array)) return;
		for (let item of json) {
			if (item.type === 'lifely') {
				await addNewTask('lifely', undefined, undefined, undefined, item.event, item.score, item.done, item.appendix);
			}
			else if (item.type === 'yearly') {
				await addNewTask('yearly', item.year, undefined, undefined, item.event, item.score, item.done, item.appendix);
			}
			else if (item.type === 'monthly') {
				await addNewTask('monthly', item.year, item.month, undefined, item.event, item.score, item.done, item.appendix);
			}
			else if (item.type === 'weekly') {
				await addNewTask('weekly', item.year, item.month, item.day, item.event, item.score, item.done, item.appendix);
			}
			else if (item.type === 'daily') {
				await addNewTask('daily', item.year, item.month, item.day, item.event, item.score, item.done, item.appendix);
			}
		}
		vCal.update();
		vCal.showTasks(info.index, info.year, info.month, info.other);
	};
	reader.readAsText(file);
};
const getTimeUsage = () => new Promise(res => {
	var tag = 'GETTIMEUSAGE';
	Waiters[tag] = Waiters[tag] || [];
	Waiters[tag].push(res);
	chrome.runtime.sendMessage({ event: 'getTimeUsage' });
});

// 日历

const DayLong = 24 * 3600 * 1000;
const MonthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeap = y => {
	if (Math.floor(y / 4) * 4 !== y) return false;
	if (Math.floor(y / 100) * 100 !== y) return true;
	if (Math.floor(y / 400) * 400 !== y) return false;
	return true;
};
const toMonday = (year, month, day) => {
	var d = new Date([year, month, day].join('-'));
	var m = d.getDay();
	if (m === 0) m = 7;
	m --;
	d = d.getTime() - m * 1000 * 3600 * 24;
	d = new Date(d);
	return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
};

const data = {
	title: 'Hello!',
	year: now.getFullYear(),
	month: 1 + now.getMonth(),
	day: now.getDate(),
	rows: [],
	monthly: {
		degree: 0,
		total: 0,
		count: 0
	},
	yearly: {
		degree: 0,
		total: 0,
		count: 0
	},
	lifely: {
		degree: 0,
		total: 0,
		count: 0
	},
	notdone: {
		life: [],
		year: [],
		month: [],
		week: [],
		day: []
	},
	showChronos: false,
	chronos: [],
	showTimeUsage: false,
	usage: []
};
const info = {
	title: '',
	index: 0,
	type: '',
	year: 0,
	month: 0,
	day: 0,
	other: 0,
	total: 0,
	count: 0,
	percent: 0,
	list: [],
	subsTotal: 0,
	subsCount: 0,
	_cancel: false,
	modifier: null,
	showAppend: false,
	appendix: '',
	aid: ''
};
var lastSelectedDay = false;

const vCal = new Vue({
	el: 'div[module="calendar"]',
	data,
	mounted: function () {
		this.$el.classList.add('vCalendar');
	},
	methods: {
		moveDate: (dltY, dltM) => {
			var y = data.year + dltY;
			var m = data.month + dltM;
			if (m <= 0) {
				y --;
				m += 12;
			}
			else if (m > 12) {
				y ++;
				m -= 12;
			}
			data.year = y;
			data.month = m;
			vCal.update();
		},
		update: async () => {
			now = new Date();
			var cy = now.getFullYear(), cm = now.getMonth() + 1, cd = now.getDate();
			var isToday = cy === data.year && cm === data.month;

			var dataList = await getData(data.year, data.month);
			if (dataList.year !== data.year || dataList.month !== data.month) return;
			var notdone = dataList.notdone;
			dataList = dataList.data;

			data.monthly.total = dataList.monthly.total;
			data.monthly.count = dataList.monthly.count;
			data.monthly.degree = dataList.monthly.total === 0 ? 0 : dataList.monthly.count / dataList.monthly.total * 360;
			data.yearly.total = dataList.yearly.total;
			data.yearly.count = dataList.yearly.count;
			data.yearly.degree = dataList.yearly.total === 0 ? 0 : dataList.yearly.count / dataList.yearly.total * 360;
			data.lifely.total = dataList.lifely.total;
			data.lifely.count = dataList.lifely.count;
			data.lifely.degree = dataList.lifely.total === 0 ? 0 : dataList.lifely.count / dataList.lifely.total * 360;

			var weekly = dataList.weekly;
			dataList = dataList.daily;
			var origin = new Date(data.year + '-' + data.month + '-1');
			var day = origin.getDay();
			if (day === 0) day = 7;
			var count = MonthDays[data.month];
			if (data.month === 2 && isLeap(data.year)) count ++;
			var rows = count + day - 1;
			rows = Math.ceil(rows / 7);
			var list = [];

			// 第一周，需要处理上个月的情况
			var last = origin.getTime() - (day - 1) * DayLong;
			list.push({
				total: weekly[0].total,
				count: weekly[0].count,
				percent: weekly[0].total === 0 ? 0 : weekly[0].count / weekly[0].total * 100,
				data: []
			});
			for (let j = 1; j < day; j ++) {
				let d = new Date(last);
				list[0].data.push({
					name: d.getDate(),
					disabled: true,
					percent: 0,
					total: 0,
					count: 0
				});
				last += DayLong;
			}
			var ds = 0;
			for (j = day; j <= 7; j ++) {
				ds ++;
				let d = new Date(last);
				let item = dataList[ds];
				list[0].data.push({
					name: d.getDate(),
					disabled: false,
					percent: item.total === 0 ? 0 : item.count / item.total * 100,
					total: item.total,
					count: item.count,
					selected: false,
					today: isToday && d.getDate() === cd
				});
				last += DayLong;
			}

			// 处理之后的每周
			for (let i = 1; i < rows; i ++) {
				list.push({
					total: weekly[i].total,
					count: weekly[i].count,
					percent: weekly[i].total === 0 ? 0 : weekly[i].count / weekly[i].total * 100,
					data: []
				});
				for (j = 1; j <= 7; j ++) {
					ds ++;
					let disabled = ds > count;
					let d = new Date(last);
					let item = dataList[ds];
					if (disabled || !item) item = { total: 1, count: 0 };
					list[i].data.push({
						name: d.getDate(),
						disabled,
						percent: item.total === 0 ? 0 : item.count / item.total * 100,
						total: item.total,
						count: item.count,
						selected: false,
						today: !disabled && isToday && d.getDate() === cd
					});
					last += DayLong;
				}
			}
			data.rows.splice(0, data.rows.length, ...list);

			notdone.life = notdone.life.filter(item => item.score >= 0);
			notdone.year = notdone.year.filter(item => item.score >= 0);
			notdone.month = notdone.month.filter(item => item.score >= 0);
			notdone.week = notdone.week.filter(item => item.score >= 0);
			notdone.day = notdone.day.filter(item => item.score >= 0);
			notdone.week.forEach(item => {
				var d = new Date(item.year + '-' + item.month + '-' + item.day);
				d = d.getDay();
				if (d === 0) d = 7;
				d = 7 - d;
				d = item.day + d;
				item.wd = d / 7 - 1;
			});
			data.notdone.life.splice(0, data.notdone.life.length, ...notdone.life);
			data.notdone.year.splice(0, data.notdone.year.length, ...notdone.year);
			data.notdone.month.splice(0, data.notdone.month.length, ...notdone.month);
			data.notdone.week.splice(0, data.notdone.week.length, ...notdone.week);
			data.notdone.day.splice(0, data.notdone.day.length, ...notdone.day);

			var wk = toMonday(cy, cm, cd)[2];
			count = 0;
			if (cd > 20) notdone.month.forEach(item => {
				if (item.year > cy) return;
				if (item.year === cy && item.month > cm) return;
				count ++;
			});
			notdone.week.forEach(item => {
				if (item.year > cy) return;
				if (item.year === cy && item.month > cm) return;
				if (item.year === cy && item.month === cm && item.day > wk) return;
				count ++;
			});
			notdone.day.forEach(item => {
				if (item.year > cy) return;
				if (item.year === cy && item.month > cm) return;
				if (item.year === cy && item.month === cm && item.day > cd) return;
				count ++;
			});
			if (count === 0) {
				chrome.browserAction.setBadgeText({ text: '' });
			}
			else {
				if (count > 9) count = '9+';
				else count = count + '';
				chrome.browserAction.setBadgeText({ text: count });
			}
		},
		showTasks: async (type, year, month, other, target) => {
			// 0: daily; 1: weekly; 2: monthly; 3: yearly; 4: lifely; 5: schedule

			var title, origin = other;
			if (type === 4) title = '命度任务清单';
			else if (type === 3) title = year + ' 年度任务清单';
			else if (type === 2) title = year + '/' + month + ' 月度任务清单';
			else if (type === 1) {
				other = other * 7 + 1;
				title = year + '/' + month + ' 周度任务清单';
			}
			else if (type === 0) title = year + '/' + month + '/' + other + ' 日度任务清单';
			else return;

			info.title = title;
			info.total = 0;
			info.count = 0;
			info.percent = 0;

			document.body.classList.add('expanded');
			var tasks = await getTaskList(type, year, month, other, false);
			info.subsTotal = tasks.subs[0];
			info.subsCount = tasks.subs[1];
			var t = 0, c = 0;
			tasks.tasks.forEach(item => {
				if (item.score > 0) t += item.score;
				if (item.done) c += item.score;
				if (!item.appendix) return;
				item.appendix = item.appendix.split(/\n+/);
			});
			info.total = t;
			info.count = c;
			if (type === 4) info.type = 'lifely';
			else if (type === 3) info.type = 'yearly';
			else if (type === 2) info.type = 'monthly';
			else if (type === 1) info.type = 'weekly';
			else {
				info.type = 'daily';
				if (!!lastSelectedDay) lastSelectedDay.selected = false;
				if (!!target) {
					target.selected = true;
					lastSelectedDay = target;
				}
			}
			info.index = type;
			info.year = year;
			info.month = month;
			info.day = other;
			info.other = origin;
			if (t > 0) {
				let p = c / t * 100;
				p = Math.round(p * 100) / 100;
				info.percent = p;
			}
			info.list.splice(0, info.list.length, ...tasks.tasks);
		},
		exports: () => {
			chrome.runtime.sendMessage({ event: 'exportAll' });
		},
		imports: () => {
			uploader.click();
		},
		openChronos: async () => {
			data.showChronos = true;
			var tasks = await getAll();

			var result = {};
			tasks.forEach(item => {
				if (item.type === 'lifely') return;
				var y = result[item.year];
				if (!y) {
					y = { year: item.year, month: {}, total: 0, done: 0 };
					result[item.year] = y;
				}
				if (item.type === 'yearly') {
					if (item.score > 0) y.total += item.score;
					if (item.done) y.done += item.score;
				}
				else {
					let m = y.month[item.month];
					if (!m) {
						m = { total: 0, done: 0, weeks: {}, days: { total: 0, done: 0 } };
						y.month[item.month] = m;
					}
					if (item.type === 'monthly') {
						if (item.score > 0) m.total += item.score;
						if (item.done) m.done += item.score;
					}
					else if (item.type === 'weekly') {
						let w = m.weeks[item.day];
						if (!w) {
							w = { total: 0, done: 0 };
							m.weeks[item.day] = w;
						}
						if (item.score > 0) w.total += item.score;
						if (item.done) w.done += item.score;
					}
					else if (item.type === 'daily') {
						if (item.score > 0) m.days.total += item.score;
						if (item.done) m.days.done += item.score;
					}
				}
			});
			for (let yid in result) {
				let year = result[yid];
				let list = [];
				let max = 0;
				for (let i = 0; i < 12; i ++) list[i] = {total: 0, done: 0}
				for (let mid in year.month) {
					let month = year.month[mid];
					if (month.days.total > 0) {
						month.total ++;
						if (month.days.done >= month.days.total) month.done ++;
					}
					for (let week in month.weeks) {
						week = month.weeks[week];
						if (week.total > 0) {
							month.total ++;
							if (week.done >= week.total) month.done ++;
						}
					}
					if (month.total > 0) {
						year.total ++;
						if (month.done >= month.total) year.done ++;
					}
					let li = list[mid * 1 - 1];
					li.total = month.total;
					li.done = month.done;
					if (month.total > max) max = month.total;
				}
				result[yid] = {
					year: yid,
					total: year.total,
					done: year.done,
					max,
					month: list
				};
			}
			data.chronos.splice(0, data.chronos.length, ...(Object.keys(result).map(year => result[year])));
		},
		showUsage: async () => {
			var result = await getTimeUsage();
			if (!result) return;
			data.showTimeUsage = true;
			data.usage.splice(0, data.usage.length, ...result);
		}
	}
});
const vPad = new Vue({
	el: 'div[module="infoPad"]',
	data: info,
	mounted: function () {
		this.$el.classList.add('vInfoPad');
	},
	methods: {
		closePad: () => {
			document.body.classList.remove('expanded');
		},
		change: async id => {
			if (info._cancel) {
				info._cancel = false;
				return;
			}
			var action;
			info.list.some(item => {
				var got = id === item.id;
				if (!got) return false;
				item.done = !item.done;
				if (item.done) info.count += item.score;
				else info.count -= item.score;
				action = changeTaskStatus(info.type, info.year, info.month, info.day, id, item.done);
				return true;
			});
			await action;
			vCal.update();
			if (info.total > 0) {
				let p = info.count / info.total * 100;
				p = Math.round(p * 100) / 100;
				info.percent = p;
			}
		},
		modify: async id => {
			info._cancel = true;
			var item = info.list.filter(item => item.id === id)[0];
			if (!item) return;

			vPad.$el.querySelector('div.addNew input[name="task"]').value = item.event;
			vPad.$el.querySelector('div.addNew input[name="score"]').value = item.score;
			info.modifier = item;
		},
		remove: async id => {
			info._cancel = true;
			await removeTask(info.type, info.year, info.month, info.day, id);
			vCal.update();
			vCal.showTasks(info.index, info.year, info.month, info.other);
		},
		append: async id => {
			info._cancel = true;
			info.aid = id;
			info.appendix = await getAppendix(info.type, info.year, info.month, info.day, id);
			info.showAppend = true;
		},
		addAppendix: async () => {
			var text = vPad.$el.querySelector('div.frame div.appendInfo textarea').value;
			await setAppendix(info.type, info.year, info.month, info.day, info.aid, text);
			info.showAppend = false;
			info.appendix = '';
			info.aid = '';
			vCal.showTasks(info.index, info.year, info.month, info.other);
		},
		changeScore: () => {
			var score = vPad.$el.querySelector('div.addNew input[name="score"]');
			var s = score.value * 1;
			var changed = false;
			if (s < -5) {
				s = -5;
				changed = true;
			}
			else if (s > 10) {
				s = 10;
				changed = true;
			}
			if (changed) score.value = s;
		},
		addNew: async () => {
			var elEvent = vPad.$el.querySelector('div.addNew input[name="task"]');
			var event = elEvent.value.toString().trim();
			if (!event || event.length === 0) return;
			var elScore = vPad.$el.querySelector('div.addNew input[name="score"]');
			var score = elScore.value * 1;
			if (isNaN(score)) return;

			if (info.modifier !== null) {
				await modifyTask(info.type, info.year, info.month, info.day, info.modifier.id, event, score);
				info.modifier = null;
			}
			else {
				await addNewTask(info.type, info.year, info.month, info.day, event, score);
			}

			vCal.update();
			vCal.showTasks(info.index, info.year, info.month, info.other);
			elEvent.value = '';
			elScore.value = 1;
		}
	}
});

uploader.onchange = readFile;
vCal.update();