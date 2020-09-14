const { expect } = require("chai");
const knex = require("knex");
const app = require("../src/app");
const {
  makeBookmarksArray,
  makeMaliciousBookmark,
} = require("./bookmarks.fixtures");

describe("Bookmarks Endpoints", function () {
  let db;

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DB_URL,
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("clean the table", () => db("bookmarks").truncate());

  afterEach("cleanup", () => db("bookmarks").truncate());

  describe(`GET /bookmarks`, () => {
    context(`Given no bookmarks`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get("/bookmarks")
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`) //this part was tricky, it was giving the 401 not authorized for every test until I discovered this.  Must set the auth in the test using .set()
          .expect(200, []);
      });
    });
    context("Given there are bookmarks in the database", () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach("insert bookmarks", () => {
        return db.into("bookmarks").insert(testBookmarks);
      });

      it("responds with 200 and all of the bookmarks", () => {
        return supertest(app)
          .get("/bookmarks")
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });
    context(`Given an XSS attack bookmark`, () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach("insert malicious bookmark", () => {
        return db.into("bookmarks").insert([maliciousBookmark]);
      });

      it("removes XSS attack content", () => {
        return supertest(app)
          .get(`/bookmarks`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect((res) => {
            expect(res.body[0].title).to.eql(expectedBookmark.title);
            expect(res.body[0].description).to.eql(
              expectedBookmark.description
            );
          });
      });
    });

    describe(`POST /bookmarks`, () => {
      it(`creates a bookmark, responding with 201 and the new bookmark`, function () {
        this.retries(3);
        const newBookmark = {
          title: "Test Bookmark!",
          url: "www.newurl.org",
          description: "stupid crap",
          rating: "3",
        };
        return supertest(app)
          .post("/bookmarks")
          .send(newBookmark)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(201)
          .expect((res) => {
            expect(res.body.title).to.eql(newBookmark.title);
            expect(res.body.url).to.eql(newBookmark.url);
            expect(res.body.description).to.eql(newBookmark.description);
            expect(res.body).to.have.property("id");
            expect(res.headers.location).to.eql(`/bookmarks/${res.body.id}`);
            expect(res.body.rating).to.eql(newBookmark.rating);
          })
          .then((res) =>
            supertest(app)
              .get(`/bookmarks/${res.body.id}`)
              .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
              .expect(res.body)
          );
      });

      describe(`GET /bookmarks/:bookmarks_id`, () => {
        context(`Given no bookmarks`, () => {
          it(`responds with 404`, () => {
            const bookmarkId = 123456;
            return supertest(app)
              .get(`/bookmarks/${bookmarkId}`)
              .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
              .expect(404, { error: { message: `Bookmark Not Found` } });
          });
        });

        context("Given there are bookmarks in the database", () => {
          const testBookmarks = makeBookmarksArray();

          beforeEach("insert bookmarks", () => {
            return db.into("bookmarks").insert(testBookmarks);
          });

          it("responds with 200 and the specified bookmark", () => {
            const bookmarkId = 2;
            const expectedBookmark = testBookmarks[bookmarkId - 1];
            return supertest(app)
              .get(`/bookmarks/${bookmarkId}`)
              .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
              .expect(200, expectedBookmark);
          });
        });

        describe(`DELETE /bookmarks/:bookmark_id`, () => {
          context(`Given no bookmarks`, () => {
            it(`responds with 404`, () => {
              const bookMarkId = 123456;
              return supertest(app)
                .delete(`/bookmarks/${bookMarkId}`)
                .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
                .expect(404, { error: { message: `Bookmark Not Found` } });
            });
          });

          context("Given there are bookmarks in the database", () => {
            const testBookmarks = makeBookmarksArray();

            beforeEach("insert bookmarks", () => {
              return db.into("bookmarks").insert(testBookmarks);
            });

            it("responds with 204 and removes the article", () => {
              const idToRemove = 2;
              const expectedBookmark = testBookmarks.filter(
                (bookmark) => bookmark.id !== idToRemove
              );
              return supertest(app)
                .delete(`/bookmarks/${idToRemove}`)
                .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
                .expect(204)
                .then((res) =>
                  supertest(app)
                    .get(`/bookmarks`)
                    .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
                    .expect(expectedBookmark)
                );
            });
          });
        });
      });
    });
  });
});
