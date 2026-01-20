(() => {
  fetch('/includes/head.html')
    .then((response) => {
      if (!response.ok) throw new Error('Failed to load head');
      return response.text();
    })
    .then((html) => {
      document.head.insertAdjacentHTML('beforeend', html);
    })
    .catch((error) => {
      console.error(error);
    });
})();
