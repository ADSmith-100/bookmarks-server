const express = require("express");
const logger = require("../logger");
const xss = require("xss");
const BookmarksService = require("../bookmarks-service");

const bookMarkRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = (bookmark) => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: bookmark.url,
  description: xss(bookmark.description),
  rating: bookmark.rating,
});

bookMarkRouter
  .route("/bookmarks")
  .get((req, res, next) => {
    const knexInstance = req.app.get("db");
    BookmarksService.getAllBookmarks(knexInstance)
      .then((bookmark) => {
        res.json(bookmark.map(serializeBookmark));
      })
      .catch(next);
  })

  .post(bodyParser, (req, res, next) => {
    const { title, url, description, rating } = req.body;

    const newBookmark = { title, url, description, rating };

    if (rating <= 0 || rating > 5) {
      logger.error(`Rating must be between 1 and 5`);
      return res.status(400).send("Rating must be between 1 and 5");
    }

    for (const [key, value] of Object.entries(newBookmark))
      if (value == null)
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` },
        });

    // if (!title) {
    //   logger.error(`Title is required`);
    //   return res.status(400).send("Invalid data");
    // }

    // if (!url) {
    //   logger.error(`URL is required`);
    //   return res.status(400).send("Invalid data");
    // }

    // if (!description) {
    //   logger.error(`Description is required`);
    //   return res.status(400).send("Invalid data");
    // }

    // if (!rating) {
    //   logger.error(`Rating is required`);
    //   return res.status(400).send("Invalid data");
    // }

    BookmarksService.insertBookmark(req.app.get("db"), newBookmark)
      .then((bookmark) => {
        res
          .status(201)
          .location(`/bookmarks/${bookmark.id}`)
          .json(serializeBookmark(bookmark));
      })
      .catch(next);
  });

bookMarkRouter
  .route("/bookmarks/:bookmark_id")
  .all((req, res, next) => {
    const { bookmark_id } = req.params;
    BookmarksService.getById(req.app.get("db"), bookmark_id)
      .then((bookmark) => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${bookmark_id} not found.`);
          return res.status(404).json({
            error: { message: `Bookmark Not Found` },
          });
        }
        res.bookmark = bookmark;
        next();
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json({
      id: res.bookmark.id,
      title: xss(res.bookmark.title), // sanitize title
      url: res.bookmark.url,
      description: xss(res.bookmark.description), // sanitize description
      rating: res.bookmark.rating,
    });
  })
  .delete((req, res, next) => {
    BookmarksService.deleteBookmark(
      req.app.get("db"),
      req.params.bookmark_id
    ).then(() => {
      BookmarksService.deleteBookmark(req.app.get("db"), req.params.bookmark_id)
        .then(() => {
          res.status(204).end();
        })
        .catch(next);
    });
  });

module.exports = bookMarkRouter;
