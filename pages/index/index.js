Page({
  data: {
    images: [
      {
        id: 1,
        name: '山川云海',
        url: '/images/photo1.jpg'
      },
      {
        id: 2,
        name: '日落海滩',
        url: '/images/photo2.jpg'
      },
      {
        id: 3,
        name: '森林小径',
        url: '/images/photo3.jpg'
      },
      {
        id: 4,
        name: '星空银河',
        url: '/images/photo4.jpg'
      },
      {
        id: 5,
        name: '山间溪流',
        url: '/images/photo5.jpg'
      },
      {
        id: 6,
        name: '春日樱花',
        url: '/images/photo6.jpg'
      }
    ]
  },

  startPuzzle(e) {
    const imageUrl = e.currentTarget.dataset.image
    wx.navigateTo({
      url: `/pages/puzzle/puzzle?image=${encodeURIComponent(imageUrl)}`
    })
  }
})