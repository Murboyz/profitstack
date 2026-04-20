
      if (req.method === 'GET' && pathname === '/api/dashboard') {
        async function handleDashboard() {
          const [crmConnection, weekMetrics, overrides, organizationSettings, latestSnapshot] = await Promise.all([
            getCrmConnectionByOrg(viewContext.organization.id),
            getWeekMetricsByOrg(viewContext.organization.id),
            getMetricOverridesByOrg(viewContext.organization.id),
            getOrganizationSettingsByOrg(viewContext.organization.id),
            getLatestCrmSnapshotByOrg(viewContext.organization.id),
          ]);
          const liveWeeks = buildWeeksFromMetrics(weekMetrics);
          const mergedWeeks = applyOverridesToWeeks(liveWeeks, overrides);
          const rollups = latestSnapshot?.payload?.rollups || null;

          function sumMonthScheduledProduction(mergedWeeks, currentMonthKey) {
            let total = 0;
            for (const week of Object.values(mergedWeeks)) {
              const weekStart = new Date(week.weekStartDate + 'T00:00:00.000Z');
              const weekEnd = new Date(week.weekEndDate + 'T23:59:59.999Z');

              const [year, month] = currentMonthKey.split('-').map(Number);
              const monthStart = new Date(Date.UTC(year, month - 1, 1));
              const monthEnd = new Date(Date.UTC(year, month, 1));

              const overlapStart = weekStart > monthStart ? weekStart : monthStart;
              const overlapEnd = weekEnd < monthEnd ? weekEnd : monthEnd;

              if (overlapEnd <= overlapStart) continue;

              const totalWeekDays = (weekEnd - weekStart) / (1000 * 60 * 60 * 24);
              const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24);

              total += (overlapDays / totalWeekDays) * (week.scheduledProduction || 0);
            }
            return total;
          }

          const currentMonthKey = formatDateInTimeZone(new Date(), 'UTC').slice(0, 7);
          const persistentMonthScheduledProduction = sumMonthScheduledProduction(mergedWeeks, currentMonthKey);

          return sendJson(res, 200, {
            organization: formatSession(viewContext).organization,
            settings: formatOrganizationSettings(organizationSettings, viewContext.organization.id, {
              ...rollups,
              monthScheduledProduction: persistentMonthScheduledProduction,
            }),
            crmConnection: formatDashboardCrmConnection(crmConnection),
            weeks: mergedWeeks,
            weekHistory: formatWeekHistory(weekMetrics, overrides),
            overridesApplied: summarizeOverridesByWeek(mergedWeeks, overrides),
          });
        }

        await handleDashboard();
res.end();
      }
