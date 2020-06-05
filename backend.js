// 数据库

window.shrineStorage = new CacheStorage('ChronosShrine', 1);

// 页面停留时间

const ChronosGuard = {
	current: null,
	stamp: 0,
	timer: null,
	records: {},
	totalTime: 0,
	interval: 1000 * 1,
	idle: 1000 * 60,
	max: 25,
	limit: 15,
	monitor: () => {
		ChronosGuard.timer = null;
		chrome.windows.getLastFocused({populate: true}, win => {
			if (!win.focused) return ChronosGuard.pause();
			var tab = null;
			win.tabs.some(t => {
				if (t.active) tab = t;
				return t.active
			});
			if (!tab) return ChronosGuard.pause();
			ChronosGuard.update(tab.url);
		});
	},
	switch: tabId => {
		chrome.tabs.get(tabId, tab => {
			if (!tab.active || !tab.selected) return;
			ChronosGuard.update(tab.url);
		});
	},
	update: url => {
		if (!url) return ChronosGuard.pause();
		url = new URL(url);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return ChronosGuard.pause();
		if (url.hostname === 'localhost') return ChronosGuard.pause();
		if (url.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) return ChronosGuard.pause();
		if (url.hostname.match(/^[\d:]+$/)) return ChronosGuard.pause();
		if (!!ChronosGuard.timer) clearTimeout(ChronosGuard.timer);

		url = url.hostname;
		var now = Date.now(), delta = 0;
		if (ChronosGuard.stamp > 0) {
			delta = now - ChronosGuard.stamp;
		}
		ChronosGuard.stamp = now;
		if (!ChronosGuard.current) {
			ChronosGuard.current = url;
			delta = 0;
		}
		chrome.idle.queryState(ChronosGuard.idle, status => {
			ChronosGuard.timer = setTimeout(ChronosGuard.monitor, ChronosGuard.interval);
			if (status !== 'active') return;
			ChronosGuard.totalTime += delta;
			ChronosGuard.records[ChronosGuard.current] = (ChronosGuard.records[ChronosGuard.current] || 0) + delta;
			ChronosGuard.current = url;
			ChronosGuard.save();
		});
	},
	pause: () => {
		if (!!ChronosGuard.timer) {
			clearTimeout(ChronosGuard.timer);
		}
		var now = Date.now(), delta = 0;
		if (ChronosGuard.stamp > 0) {
			delta = now - ChronosGuard.stamp;
		}
		ChronosGuard.stamp = 0;
		if (!!ChronosGuard.current) {
			ChronosGuard.totalTime += delta;
			ChronosGuard.records[ChronosGuard.current] = (ChronosGuard.records[ChronosGuard.current] || 0) + delta;
		}
		ChronosGuard.current = null;
	},
	save: () => {
		var list = Object.keys(ChronosGuard.records).map(url => {
			return {url, count: ChronosGuard.records[url]};
		});
		list.sort((a, b) => b.count - a.count);
		if (list.length > ChronosGuard.max) list = list.splice(0, ChronosGuard.limit);
		var result = {};
		list.forEach(item => result[item.url] = item.count);
		ChronosGuard.records = result;
		shrineStorage.setTimeUsage(ChronosGuard.records, ChronosGuard.totalTime);
	},
};
const convertTimeString = timespent => {
	timespent = Math.round(timespent / 1000);
	if (timespent < 60) return timespent + 's';
	var m = Math.floor(timespent / 60);
	timespent = timespent - m * 60;
	[timespent, m] = [m, timespent];
	var result = m + 's';
	if (timespent < 60) return timespent + 'm ' + result;
	m = Math.floor(timespent / 60);
	timespent = timespent - m * 60;
	[timespent, m] = [m, timespent];
	result = m + 'm ' + m;
	return timespent + 'h ' + result;
};

chrome.tabs.onActivated.addListener(evt => {
	ChronosGuard.switch(evt.tabId);
});
chrome.tabs.onUpdated.addListener(tabId => {
	ChronosGuard.switch(tabId);
});
chrome.windows.onFocusChanged.addListener(winId => {
	if (winId === -1) {
		ChronosGuard.pause();
	}
	else {
		chrome.tabs.getSelected(winId, tab => {
			ChronosGuard.switch(tab.id);
		});
	}
});

// 通讯应答

const Responsors = {};
const sendToTab = (tid, event, ok, data) => {
	chrome.tabs.sendMessage(tid, { event, ok, data });
};
chrome.runtime.onMessage.addListener((msg, sender) => {
	var event = msg.event;
	if (!event) {
		sendToTab(sender.tab.id, 'error', false, 'Event could not be empty!');
		return;
	}
	var cb = Responsors[event];
	if (!cb) {
		sendToTab(sender.tab.id, event, false, 'No such responsor!');
		return;
	}
	cb(msg, sender.tab.id);
});

Responsors.getTaskList = async (data, tab) => {
	var result;
	if (data.type === 4) result = await shrineStorage.getLifely();
	else if (data.type === 3) result = await shrineStorage.getYearly(data.year);
	else if (data.type === 2) result = await shrineStorage.getMonthly(data.year, data.month);
	else if (data.type === 1) result = await shrineStorage.getWeekly(data.year, data.month, data.day);
	else if (data.type === 0) result = await shrineStorage.getDaily(data.year, data.month, data.day);
	else {
		sendToTab(tab, data.event, false, 'Wrong event type!')
		return;
	}
	if (data.onlynotdone) {
		result = result.filter(item => !item.done);
	}
	sendToTab(tab, data.event, true, {
		type: data.type,
		year: data.year,
		month: data.month,
		day: data.day,
		onlynotdone: data.onlynotdone,
		tasks: result
	});
};
Responsors.addNewTask = async (data, tab) => {
	await shrineStorage.add(data.type, data.year, data.month, data.day, data.task, data.score, data.done, data.appendix);
	sendToTab(tab, data.event, true, data);
};
Responsors.changeTaskStatus = async (data, tab) => {
	var done = await shrineStorage.set(data.type, data.year, data.month, data.day, data.id, data.status);
	if (done) sendToTab(tab, data.event, true, data);
	else sendToTab(tab, data.event, false, 'No such task!');
};
Responsors.getPageInfo = async (data, tab) => {
	var result = await shrineStorage.getPageInfo(data.year, data.month);
	sendToTab(tab, data.event, true, result);
};
Responsors.removeTask = async (data, tab) => {
	var done = await shrineStorage.del(data.type, data.year, data.month, data.day, data.id);
	if (done) sendToTab(tab, data.event, true, data);
	else sendToTab(tab, data.event, false, 'No such task!');
};
Responsors.modifyTask = async (data, tab) => {
	var done = await shrineStorage.modify(data.type, data.year, data.month, data.day, data.id, data.task, data.score);
	if (done) sendToTab(tab, data.event, true, data);
	else sendToTab(tab, data.event, false, 'No such task!');
};
Responsors.exportAll = async (data, tab) => {
	var allTasks = await shrineStorage.export();
	sendToTab(tab, data.event, true, allTasks);
};
Responsors.getAll = async (data, tab) => {
	var allTasks = await shrineStorage.export();
	sendToTab(tab, data.event, true, allTasks);
};
Responsors.getAppendix = async (data, tab) => {
	var appendix = await shrineStorage.getAppendix(data.type, data.year, data.month, data.day, data.id);
	if (appendix !== null) {
		data.appendix = appendix;
		sendToTab(tab, data.event, true, data);
	}
	else sendToTab(tab, data.event, false, 'No such task!');
};
Responsors.setAppendix = async (data, tab) => {
	var done = await shrineStorage.setAppendix(data.type, data.year, data.month, data.day, data.id, data.appendix);
	if (done) sendToTab(tab, data.event, true, data);
	else sendToTab(tab, data.event, false, 'No such task!');
};
Responsors.getTimeUsage = (data, tab) => {
	var total = 0
	var list = Object.keys(ChronosGuard.records).map(url => {
		return {url, count: ChronosGuard.records[url]};
	});
	list.sort((a, b) => b.count - a.count);
	if (list.length > ChronosGuard.limit) list = list.splice(0, ChronosGuard.limit);
	list.forEach(item => total += item.count);
	total = ChronosGuard.totalTime - total;
	if (total > 0) {
		list.push({
			url: 'other',
			count: total
		});
	}
	list.forEach(item => {
		item.percent = item.count / ChronosGuard.totalTime * 100;
		item.time = convertTimeString(item.count);
	});

	sendToTab(tab, data.event, true, list);
};

// 点击事件

const IndexURL = chrome.extension.getURL('/index.html');
chrome.browserAction.onClicked.addListener(evt => {
	var aimed = false;
	chrome.windows.getAll(wins => {
		var total = wins.length;
		wins.forEach(win => {
			chrome.tabs.getAllInWindow(win.id, tabs => {
				if (aimed) return;
				var target = null;
				tabs.some(tab => {
					var found = tab.url === IndexURL;
					if (!found) return false;
					target = tab;
					return true;
				});
				total --;
				if (!target) {
					if (total === 0) chrome.tabs.create({ url: IndexURL, active: true });
					return;
				}
				aimed = true;
				chrome.windows.update(win.id, { focused: true }, () => {
					chrome.tabs.update(target.id, { highlighted: true });
				});
			});
		});
	});
});

// 定时提醒

var notifier = null;
const clearAllNotifications = () => new Promise(res => {
	chrome.notifications.getAll(all => {
		var count = Object.keys(all).length;
		if (count === 0) return res();
		for (let nid in all) {
			chrome.notifications.clear(nid, () => {
				count --;
				if (count === 0) res();
			});
		}
	});
});
const launchNotify = async () => {
	if (!!notifier) return;
	var t = new Date();
	var yr = t.getFullYear();
	var mt = t.getMonth() + 1;
	var dy = t.getDate();
	var hr = t.getHours();
	var wk = toMonday(yr, mt, dy)[2];
	t = new Date(yr + '-' + mt + '-' + dy + ' ' + hr + ':0:0');
	var delta = t.getTime() + 1000 * 3600 - Date.now();
	notifier = setTimeout(() => {
		notifier = null;
		launchNotify();
	}, delta);

	await clearAllNotifications();

	var list = await shrineStorage.getUnfinish(), count = 0, notifications = [];
	if (dy > 20) list.month.forEach(item => {
		if (item.year > yr) return;
		if (item.year === yr && item.month > mt) return;
		if (item.score < 0) return;
		count ++;
		notifications.push({
			type: 'basic',
			iconUrl: '/index.png',
			title: '待完成月度计划',
			message: item.event + '\n（' + item.score + ' 分）',
			contextMessage: item.year + '/' + item.month,
			priority: 2
		});
	});
	list.week.forEach(item => {
		if (item.year > yr) return;
		if (item.year === yr && item.month > mt) return;
		if (item.year === yr && item.month === mt && item.day > wk) return;
		if (item.score < 0) return;
		count ++;
		notifications.push({
			type: 'basic',
			iconUrl: '/index.png',
			title: '待完成周度计划',
			message: item.event + '\n（' + item.score + ' 分）',
			contextMessage: item.year + '/' + item.month,
			priority: 2
		});
	});
	list.day.forEach(item => {
		if (item.year > yr) return;
		if (item.year === yr && item.month > mt) return;
		if (item.year === yr && item.month === mt && item.day > dy) return;
		if (item.score < 0) return;
		count ++;
		notifications.push({
			type: 'basic',
			iconUrl: '/index.png',
			title: '待完成日度计划',
			message: item.event + '\n（' + item.score + ' 分）',
			contextMessage: item.year + '/' + item.month + '/' + item.day,
			priority: 2
		});
	});

	if (count === 0) {
		chrome.browserAction.setBadgeText({ text: '' });
	}
	else {
		if (count > 9) count = '9+';
		else count = count + '';
		chrome.browserAction.setBadgeText({ text: count });
	}

	var noTask = false;
	if (hr >= 22) {
		let tomorrow = getNextDay(yr, mt, dy);
		let tasks = await shrineStorage.getDaily(...tomorrow);
		if (tasks.tasks.length === 0) {
			noTask = true;
			notifications.push({
				type: 'basic',
				iconUrl: '/index.png',
				title: '请设置明天任务计划！',
				message: '明天（' + tomorrow[0] + '/' + tomorrow[1] + '/' + tomorrow[2] + '）计划尚未安排',
				contextMessage: tomorrow[0] + '/' + tomorrow[1] + '/' + tomorrow[2],
				priority: 2
			});
		}
	}
	if (count > 0 || noTask) {
		let sound = new Audio();
		sound.src = chrome.extension.getURL('ding.mp3');
		sound.play();
	}
	notifications.forEach(noti => chrome.notifications.create(noti));
};
chrome.browserAction.setBadgeBackgroundColor({ color: [194, 31, 48, 100] });

// 启动

shrineStorage.init(undefined, async () => {
	launchNotify();
	var [records, total] = await shrineStorage.getTimeUsage();
	if (!!records && !!total) {
		ChronosGuard.records = records;
		ChronosGuard.totalTime = total;
	}
});