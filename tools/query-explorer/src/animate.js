// Query Explorer: short animations that show what each step did.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, renderTable, visualPlan, colorClass } = QE;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Slide rows from their old spots to their new ones after `change` redraws them.
  function flip(holder, change) {
    const old = new Map();
    holder.querySelectorAll('tbody tr').forEach(tr => old.set(tr.dataset.row, tr.getBoundingClientRect().top));
    change();
    holder.querySelectorAll('tbody tr').forEach(tr => {
      const top = old.get(tr.dataset.row);
      if (top === undefined) return;
      const dy = top - tr.getBoundingClientRect().top;
      if (!dy) return;
      tr.style.transition = 'none';
      tr.style.transform = `translateY(${dy}px)`;
      tr.getBoundingClientRect();
      requestAnimationFrame(() => {
        tr.style.transition = 'transform .6s ease';
        tr.style.transform = '';
      });
    });
  }

  const PLAYERS = {
    filter(holder, before, plan) {
      return [
        [() => holder.replaceChildren(renderTable(before, {
          rowClass: i => plan.beforeRows[i],
          rowTag: i => (plan.beforeRows[i] === 'drop' ? h('span', { class: 'tag', 'aria-label': 'removed' }, '✕') : null),
        })), 700],
        [() => holder.querySelectorAll('tr.drop').forEach(tr => tr.classList.add('collapse')), 450],
      ];
    },

    project(holder, before, plan) {
      const dropped = new Set(plan.dropped);
      return [
        [() => holder.replaceChildren(renderTable(before, { colClass: name => (dropped.has(name) ? 'col-drop' : null) })), 700],
        [() => holder.querySelectorAll('.col-drop').forEach(el => el.classList.add('col-collapse')), 450],
      ];
    },

    join(holder, before, plan, other, step) {
      const tag = id => h('span', { class: 'tag' }, id === null ? 'no match — dropped' : '#' + (id + 1));
      const side = (title, table, match, cls) => h('div', { class: cls }, h('h3', null, title),
        renderTable(table, plan.cartesian ? {} : {
          rowClass: i => (match[i] === null ? 'nomatch' : colorClass(match[i])),
          rowTag: i => tag(match[i]),
        }));
      let stage;
      return [
        [() => {
          stage = h('div', { class: 'join-stage' }, side('Current table', before, plan.leftMatch, 'left'), side(step.table, other, plan.rightMatch, 'right'));
          holder.replaceChildren(stage);
        }, plan.cartesian ? 900 : 1100],
        [() => {
          stage.classList.add('merge');
          stage.querySelectorAll('tr.nomatch').forEach(tr => tr.classList.add('fade'));
        }, 500],
      ];
    },

    aggregate(holder, before, plan) {
      const view = order => renderTable({ ...before, rows: order.map(i => before.rows[i]) }, {
        rowKey: k => order[k],
        rowClass: k => colorClass(plan.rowGroup[order[k]]),
        rowTag: k => h('span', { class: 'tag' }, plan.labels[plan.rowGroup[order[k]]]),
      });
      const firsts = new Set(plan.order.filter((i, k) => k === 0 || plan.rowGroup[plan.order[k - 1]] !== plan.rowGroup[i]));
      return [
        [() => holder.replaceChildren(view(before.rows.map((_, i) => i))), 600],
        [() => flip(holder, () => holder.replaceChildren(view(plan.order))), 750],
        [() => holder.querySelectorAll('tbody tr').forEach(tr => { if (!firsts.has(Number(tr.dataset.row))) tr.classList.add('collapse'); }), 450],
      ];
    },
  };

  async function playStep(holder, { before, result, step, dataset, reduceMotion, isCurrent }) {
    if (reduceMotion) return true;
    const other = step.op === 'join' ? QE.loadTable(QE.findTableDef(dataset, step.table)) : null;
    const plan = visualPlan(step, before, result, other);
    const phases = PLAYERS[step.op](holder, before, plan, other, step);
    for (const [run, ms] of phases) {
      if (!isCurrent()) return false;
      run();
      await wait(ms);
    }
    return isCurrent();
  }

  root.QE = Object.assign(QE, { playStep });
})(this);
