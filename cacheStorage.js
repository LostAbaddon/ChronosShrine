(() => {
	const sortTasks = (a, b) => {
		if (a.score !== b.score) return b.score - a.score;
		if (a.year !== b.year) return a.year - b.year;
		if (a.month !== b.month) return a.month - b.month;
		if (a.day !== b.day) return a.day - b.day;
		return 0;
	};

	class CacheStorage {
		#DBName;
		#DBVersion;

		#cacheDB;
		#lastGC = 0;
		#autoGC;

		constructor (dbName, dbVersion) {
			this.#DBName = dbName;
			this.#DBVersion = dbVersion;
		}
		init (onMigrate, callback) {
			return new Promise(async res => {
				this.#cacheDB = new CachedDB(this.#DBName, this.#DBVersion);
				this.#cacheDB.onUpdate(() => {
					this.#cacheDB.open('daily', 'date');
					this.#cacheDB.open('weekly', 'date');
					this.#cacheDB.open('monthly', 'date');
					this.#cacheDB.open('yearly', 'date');
					this.#cacheDB.open('lifely', 'date');
					this.#cacheDB.open('notdone', 'id');
					if (!!onMigrate) onMigrate(this.#cacheDB);
				});
				this.#cacheDB.onConnect(() => {
					this.#cacheDB.cache('daily', 100);
					this.#cacheDB.cache('weekly', 100);
					this.#cacheDB.cache('monthly', 100);
					this.#cacheDB.cache('yearly', 100);
					this.#cacheDB.cache('lifely', 100);
					this.#cacheDB.cache('notdone', 5);
				});
				await this.#cacheDB.connect();

				if (!!callback) callback();
				res();
			});
		}
		add (type, year, month, day, event, score, done=false, appendix) {
			return new Promise(async res => {
				if (type === 'weekly') [year, month, day] = toMonday(year, month, day);
				var obj = {
					id: newID(),
					year,
					month,
					day,
					type,
					event,
					score,
					done
				};
				if (!!appendix) obj.appendix = appendix;

				var date = getDateTag(type, year, month, day);
				var [notdone, list] = await Promise.all([
					this.#cacheDB.get('notdone', 'main'),
					this.#cacheDB.get(type, date)
				]);
				if (!notdone) notdone = {};
				if (!list) list = {};

				var actions = [];
				if (!done) {
					notdone[obj.id] = obj;
					actions.push(this.#cacheDB.set('notdone', 'main', notdone));
				}
				list[obj.id] = obj;
				actions.push(this.#cacheDB.set(type, date, list));

				await Promise.all(actions);

				res();
			});
		}
		set (type, year, month, day, id, done) {
			return new Promise(async res => {
				if (type === 'weekly') [year, month, day] = toMonday(year, month, day);
				var date = getDateTag(type, year, month, day);
				var [notdone, list] = await Promise.all([
					this.#cacheDB.get('notdone', 'main'),
					this.#cacheDB.get(type, date)
				]);

				if (!list) return res(false);

				var item = list[id];
				if (!item) return res(false);

				if (item.done === done) return res(true);

				item.done = done;
				if (done) {
					if (!!notdone) delete notdone[id];
					else notdone = {};
				}
				else {
					if (!!notdone) notdone[id] = item;
					else notdone = {};
				}

				await Promise.all([
					this.#cacheDB.set('notdone', 'main', notdone),
					this.#cacheDB.set(type, date, list)
				]);

				res(true);
			});
		}
		del (type, year, month, day, id) {
			return new Promise(async res => {
				if (type === 'weekly') [year, month, day] = toMonday(year, month, day);
				var date = getDateTag(type, year, month, day);
				var [notdone, list] = await Promise.all([
					this.#cacheDB.get('notdone', 'main'),
					this.#cacheDB.get(type, date)
				]);

				if (!list) return res(false);

				var item = list[id];
				if (!item) return res(false);

				var actions = [];
				if (!item.done) {
					delete notdone[id];
					actions.push(this.#cacheDB.set('notdone', 'main', notdone));
				}
				delete list[id];
				actions.push(this.#cacheDB.set(type, date, list));

				await Promise.all(actions);

				res(true);
			});
		}
		modify (type, year, month, day, id, event, score) {
			return new Promise(async res => {
				if (type === 'weekly') [year, month, day] = toMonday(year, month, day);
				var date = getDateTag(type, year, month, day);
				var [notdone, list] = await Promise.all([
					this.#cacheDB.get('notdone', 'main'),
					this.#cacheDB.get(type, date)
				]);

				if (!list) return res(false);

				var item = list[id];
				if (!item) return res(false);
				item.event = event;
				item.score = score;

				var actions = [];
				if (!item.done) {
					notdone[id] = item;
					actions.push(this.#cacheDB.set('notdone', 'main', notdone));
				}
				actions.push(this.#cacheDB.set(type, date, list));

				await Promise.all(actions);

				res(true);
			});
		}
		getDaily (year, month, day) {
			return new Promise(async res => {
				var date = getDateTag('daily', year, month, day);
				var result = await this.#cacheDB.get('daily', date);
				var list = [];
				if (!result) return res({ tasks: list, subs: [0, 0] });
				for (let item in result) {
					item = result[item];
					list.push(item);
				}
				list.sort(sortTasks);
				result = { tasks: list, subs: [0, 0] };
				res(result);
			});
		}
		getWeekly (year, month, day) {
			return new Promise(async res => {
				[year, month, day] = toMonday(year, month, day);
				var date = getDateTag('weekly', year, month, day);
				var weekDays = getWholeWeek(year, month, day);
				var ds = weekDays.map(day => getDateTag('daily', day[0], day[1], day[2]));
				var days = [];
				var [result, ...days] = await Promise.all([
					this.#cacheDB.get('weekly', date),
					this.#cacheDB.get('daily', ds[0]),
					this.#cacheDB.get('daily', ds[1]),
					this.#cacheDB.get('daily', ds[2]),
					this.#cacheDB.get('daily', ds[3]),
					this.#cacheDB.get('daily', ds[4]),
					this.#cacheDB.get('daily', ds[5]),
					this.#cacheDB.get('daily', ds[6])
				]);
				var list = [];
				if (!!result) for (let item in result) {
					item = result[item];
					list.push(item);
				}
				list.sort(sortTasks);
				result = { tasks: list, subs: [0, 0] };
				days.forEach(items => {
					if (!items) return;
					result.subs[0] ++;
					var t = 0;
					for (let item in items) {
						item = items[item];
						if (!item.done) t ++;
					}
					if (t === 0) result.subs[1] ++;
				});
				res(result);
			});
		}
		getMonthly (year, month) {
			return new Promise(async res => {
				var date = getDateTag('monthly', year, month);
				var days = getWeeksInMonth(year, month);
				var weeks = [], result, actions = [];
				actions.push(this.#cacheDB.get('monthly', date));
				days.forEach(day => {
					day = getDateTag('weekly', day[0], day[1], day[2]);
					actions.push(this.#cacheDB.get('weekly', day));
				});
				[result, ...weeks] = await Promise.all(actions);
				var list = [];
				if (!!result) for (let item in result) {
					item = result[item];
					list.push(item);
				}
				list.sort(sortTasks);
				result = { tasks: list, subs: [0, 0] };
				weeks.forEach(items => {
					if (!items) return;
					result.subs[0] ++;
					var t = 0;
					for (let item in items) {
						item = items[item];
						if (!item.done) t ++;
					}
					if (t === 0) result.subs[1] ++;
				});
				res(result);
			});
		}
		getYearly (year) {
			return new Promise(async res => {
				var date = getDateTag('yearly', year);
				var actions = [];
				actions.push(this.#cacheDB.get('yearly', date));
				for (let i = 1; i <= 12; i ++) {
					let t = getDateTag('monthly', year, i);
					actions.push(this.#cacheDB.get('monthly', t));
				}
				var result, months = [];
				[result, ...months] = await Promise.all(actions);
				var list = [];
				if (!!result) for (let item in result) {
					item = result[item];
					list.push(item);
				}
				list.sort(sortTasks);
				result = { tasks: list, subs: [0, 0] };
				months.forEach(items => {
					if (!items) return;
					result.subs[0] ++;
					var t = 0;
					for (let item in items) {
						item = items[item];
						if (!item.done) t ++;
					}
					if (t === 0) result.subs[1] ++;
				});
				res(result);
			});
		}
		getLifely () {
			return new Promise(async res => {
				var date = getDateTag('lifely');
				var [result, years] = await Promise.all([
					this.#cacheDB.get('lifely', date),
					this.#cacheDB.all('yearly')
				]);
				var list = [];
				if (!!result) for (let item in result) {
					item = result[item];
					list.push(item);
				}
				list.sort(sortTasks);
				result = { tasks: list, subs: [0, 0] };
				for (let year in years) {
					year = years[year];
					if (!year) continue;
					result.subs[0] ++;
					let t = 0;
					for (let item in year) {
						item = year[item];
						if (!item.done) t ++;
					}
					if (t === 0) result.subs[1] ++;
				}
				res(result);
			});
		}
		getPageInfo (year, month) {
			return new Promise(async res => {
				var weeks = getWeeksInMonth(year, month);
				var days = getDaysInMonth(year, month);
				var actions = [];
				actions.push(this.#cacheDB.get('lifely', getDateTag('lifely')));
				actions.push(this.#cacheDB.all('yearly'));
				for (let i = 1; i <= 12; i ++) {
					actions.push(this.#cacheDB.get('monthly', getDateTag('monthly', year, i)));
				}
				weeks.forEach(day => {
					actions.push(this.#cacheDB.get('weekly', getDateTag('weekly', day[0], day[1], day[2])));
				});
				days.forEach(day => {
					actions.push(this.#cacheDB.get('daily', getDateTag('daily', day[0], day[1], day[2])));
				});
				actions.push(this.#cacheDB.get('notdone', 'main'));

				var results = await Promise.all(actions);
				var notdone = results.pop();
				days = results.splice(results.length - days.length, days.length);
				var wks = results.splice(results.length - weeks.length, weeks.length);
				var months = results.splice(results.length - 12, 12);
				var life = results.splice(0, 1)[0];
				results = results[0];

				var sLife = { total: 0, count: 0 }, sYear = { total: 0, count: 0 }, sMonth = { total: 0, count: 0 }, sWeek = [], tWeek = {}, sDay = [];
				if (!!life) for (let item in life) {
					item = life[item];
					if (!item) continue;
					if (item.score > 0) sLife.total += item.score;
					if (item.done) sLife.count += item.score;
				}
				if (!!results) for (let y in results) {
					let items = results[y];
					if (!items) continue;
					sLife.total ++;
					let t = 0;
					for (let item in items) {
						item = items[item];
						if (!item) continue;
						if (!item.done && item.score >= 0) t ++;
						if (item.year === year) {
							if (item.score > 0) sYear.total += item.score;
							if (item.done) sYear.count += item.score;
						}
					}
					if (t === 0) sLife.count ++;
				}
				if (!!months) for (let items of months) {
					if (!items) continue;
					sYear.total ++;
					let t = 0;
					for (let item in items) {
						item = items[item];
						if (!item) continue;
						if (!item.done && item.score >= 0) t ++;
						if (item.month === month) {
							if (item.score > 0) sMonth.total += item.score;
							if (item.done) sMonth.count += item.score;
						}
					}
					if (t === 0) sYear.count ++;
				}
				if (!!wks) wks.forEach((items, i) => {
					var t = weeks[i];
					t = t.join('-')
					var info = { total: 0, count: 0 };
					tWeek[t] = info;
					if (!items) return;
					sMonth.total ++;
					t = 0;
					for (let item in items) {
						item = items[item];
						if (!item) continue;
						if (item.score > 0) info.total += item.score;
						if (item.done) info.count += item.score;
						else if (item.score >= 0) t ++;
					}
					if (t === 0) sMonth.count ++;
				});
				if (!!days) days.forEach(items => {
					var info = { total: 0, count: 0 };
					sDay.push(info);
					if (!items) return;
					var inited = false, t = 0, w;
					for (let item in items) {
						item = items[item];
						if (!item) continue;
						if (!inited) {
							inited = true;
							w = toMonday(item.year, item.month, item.day);
							w = w.join('-');
							w = tWeek[w];
							w.total ++;
						}
						if (item.score > 0) info.total += item.score;
						if (item.done) info.count += item.score;
						else if (item.score >= 0) t ++;
					}
					if (t === 0) w.count ++;
				});
				for (let d in tWeek) {
					sWeek.push(tWeek[d]);
				}
				sDay.unshift({});
				results = {
					year, month,
					data: {
						lifely: sLife,
						yearly: sYear,
						monthly: sMonth,
						weekly: sWeek,
						daily: sDay
					}
				};

				results.notdone = {
					life: [],
					year: [],
					month: [],
					week: [],
					day: []
				};
				for (let item in notdone) {
					item = notdone[item];
					if (item.type === 'lifely') results.notdone.life.push(item);
					else if (item.type === 'yearly') results.notdone.year.push(item);
					else if (item.type === 'monthly') results.notdone.month.push(item);
					else if (item.type === 'weekly') results.notdone.week.push(item);
					else if (item.type === 'daily') results.notdone.day.push(item);
				}
				results.notdone.life.sort(sortTasks);
				results.notdone.year.sort(sortTasks);
				results.notdone.month.sort(sortTasks);
				results.notdone.week.sort(sortTasks);
				results.notdone.day.sort(sortTasks);

				res(results);
			});
		}
		getUnfinish () {
			return new Promise(async res => {
				var list = await this.#cacheDB.get('notdone', 'main');

				var result = {
					life: [],
					year: [],
					month: [],
					week: [],
					day: []
				};
				for (let item in list) {
					item = list[item];
					if (item.type === 'lifely') result.life.push(item);
					else if (item.type === 'yearly') result.year.push(item);
					else if (item.type === 'monthly') result.month.push(item);
					else if (item.type === 'weekly') result.week.push(item);
					else if (item.type === 'daily') result.day.push(item);
				}
				result.life.sort(sortTasks);
				result.year.sort(sortTasks);
				result.month.sort(sortTasks);
				result.week.sort(sortTasks);
				result.day.sort(sortTasks);

				res(result);
			});
		}
		getAppendix (type, year, month, day, id) {
			return new Promise(async res => {
				if (type === 'weekly') [year, month, day] = toMonday(year, month, day);
				var date = getDateTag(type, year, month, day);
				var list = await this.#cacheDB.get(type, date);
				if (!list) return res(null);

				var item = list[id];
				if (!item) return res(null);

				res(item.appendix || '');
			});
		}
		setAppendix (type, year, month, day, id, appendix) {
			return new Promise(async res => {
				if (type === 'weekly') [year, month, day] = toMonday(year, month, day);
				var date = getDateTag(type, year, month, day);
				var [notdone, list] = await Promise.all([
					this.#cacheDB.get('notdone', 'main'),
					this.#cacheDB.get(type, date)
				]);
				if (!list) return res(false);

				var item = list[id];
				if (!item) return res(false);
				item.appendix = appendix;

				var actions = [];
				if (!item.done) {
					notdone[id] = item;
					actions.push(this.#cacheDB.set('notdone', 'main', notdone));
				}
				actions.push(this.#cacheDB.set(type, date, list));
				await Promise.all(actions);

				res(true);
			});
		}
		export () {
			return new Promise(async res => {
				var [daily, weekly, monthly, yearly, lifely] = await Promise.all([
					this.#cacheDB.all('daily'),
					this.#cacheDB.all('weekly'),
					this.#cacheDB.all('monthly'),
					this.#cacheDB.all('yearly'),
					this.#cacheDB.all('lifely')
				]);

				var result = [], notdone = {};

				for (let items in daily) {
					items = daily[items];
					for (let item in items) {
						item = items[item];
						if (!item.done) notdone[item.id] = item;
						result.push(item);
					}
				}
				for (let items in weekly) {
					items = weekly[items];
					for (let item in items) {
						item = items[item];
						if (!item.done) notdone[item.id] = item;
						result.push(item);
					}
				}
				for (let items in monthly) {
					items = monthly[items];
					for (let item in items) {
						item = items[item];
						if (!item.done) notdone[item.id] = item;
						result.push(item);
					}
				}
				for (let items in yearly) {
					items = yearly[items];
					for (let item in items) {
						item = items[item];
						if (!item.done) notdone[item.id] = item;
						result.push(item);
					}
				}
				for (let items in lifely) {
					items = lifely[items];
					for (let item in items) {
						item = items[item];
						if (!item.done) notdone[item.id] = item;
						result.push(item);
					}
				}

				await this.#cacheDB.set('notdone', 'main', notdone);

				res(result);
			});
		}
		getTimeUsage () {
			return new Promise(async res => {
				var usage = await this.#cacheDB.get('notdone', 'usage');
				var total = await this.#cacheDB.get('notdone', 'total');
				total = total * 1;
				if (isNaN(total)) total = 0;
				res([usage, total]);
			});
		}
		setTimeUsage (usage, total) {
			return new Promise(async res => {
				await this.#cacheDB.set('notdone', 'usage', usage);
				await this.#cacheDB.set('notdone', 'total', total);
				res();
			});
		}
	}

	window.CacheStorage = CacheStorage;
}) ();