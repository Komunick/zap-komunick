import { useState, useEffect, useCallback } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { filtersToParams } from "../../components/TicketsFilters";

const useTickets = ({
  isSearch,
  searchParam,
  contactId,
  tags,
  users,
  nextUpdatedAt,
  nextTicketId,
  status,
  groups,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
  notClosed,
  all,
  filters
}) => {
  // Zap Komunick: filter panel (RF-012), sent as plain query parameters
  const filtersKey = JSON.stringify(filtersToParams(filters));
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTickets = async () => {
        try {
          const { data } = await api.get("/tickets", {
            params: {
              isSearch,
              searchParam,
              nextUpdatedAt,
              nextTicketId,
              contactId,
              tags,
              users,
              status,
              groups,
              date,
              updatedAt,
              showAll,
              queueIds,
              withUnreadMessages,
              notClosed,
              all,
              ...JSON.parse(filtersKey)
            }
          });
          if (!active) return;
          setTickets(data.tickets);
          setLoading(false);
        } catch (err) {
          if (!active) return;
          setLoading(false);
          toastError(err);
        }
      };
      fetchTickets();
    }, 500);
    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [
    searchParam,
    contactId,
    tags,
    users,
    nextUpdatedAt,
    nextTicketId,
    status,
    groups,
    date,
    updatedAt,
    showAll,
    queueIds,
    withUnreadMessages,
    isSearch,
    notClosed,
    all,
    filtersKey,
    refreshTrigger
  ]);

  const refetch = useCallback(() => {
    setRefreshTrigger(prevState => prevState + 1);
  }, []);

  const fetchSince = useCallback(
    async minUpdatedAt => {
      const { data } = await api.get("/tickets", {
        params: {
          isSearch,
          searchParam,
          contactId,
          tags,
          users,
          status,
          groups,
          date,
          updatedAt,
          showAll,
          queueIds,
          withUnreadMessages,
          notClosed,
          all,
          minUpdatedAt,
          ...JSON.parse(filtersKey)
        }
      });
      return data.tickets;
    },
    [
      isSearch,
      searchParam,
      contactId,
      tags,
      users,
      status,
      groups,
      date,
      updatedAt,
      showAll,
      queueIds,
      withUnreadMessages,
      notClosed,
      all,
      filtersKey
    ]
  );

  return {
    tickets,
    loading,
    refetch,
    fetchSince
  };
};

export default useTickets;
