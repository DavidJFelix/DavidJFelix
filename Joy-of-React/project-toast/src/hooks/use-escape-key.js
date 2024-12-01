function useEscapeKey(callback) {
  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') {
        callback();
      }
    }

    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [callback]);
}

export default useEscapeKey;